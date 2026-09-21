import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { EARLIEST_YEAR, MONTH_NAMES, buildDate, dateProblem, splitDate } from '@core/memory-date';
import { DEFAULT_FOCUS, ImageFocus } from '@core/memory.model';
import { MemoryStore } from '@core/memory.store';
import { PhotoError, PreparedPhoto, photoDateOf, preparePhoto } from './photo-import';
import { PhotoFramer } from './photo-framer/photo-framer';

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 400;

type PhotoState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; photo: PreparedPhoto }
  | { status: 'error'; message: string };

/**
 * Le formulaire d'ajout d'un souvenir : la photo (réduite, redressée, sans métadonnées), son cadrage, un titre, une date
 * (lue dans la photo quand elle y est) et une description. Se ferme avec l'identifiant du souvenir créé.
 */
@Component({
  selector: 'app-memory-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    PhotoFramer,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './memory-form.html',
  styleUrl: './memory-form.scss',
})
export class MemoryForm {
  private readonly store = inject(MemoryStore);
  private readonly dialogRef = inject<MatDialogRef<MemoryForm, string>>(MatDialogRef);

  protected readonly titleMax = TITLE_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;
  protected readonly earliestYear = EARLIEST_YEAR;
  protected readonly thisYear = new Date().getFullYear();
  protected readonly months = MONTH_NAMES;

  protected readonly form = new FormGroup(
    {
      title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(TITLE_MAX)] }),
      // L'année suffit : elle range le souvenir dans l'album. Le mois et le jour sont facultatifs.
      year: new FormControl<number | null>(null, {
        validators: [Validators.required, Validators.min(EARLIEST_YEAR), Validators.max(this.thisYear)],
      }),
      month: new FormControl<number | null>(null),
      day: new FormControl<number | null>(null, { validators: [Validators.min(1), Validators.max(31)] }),
      description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(DESCRIPTION_MAX)] }),
    },
    { validators: dateValidator },
  );

  protected readonly photo = signal<PhotoState>({ status: 'none' });
  protected readonly focus = signal<ImageFocus>(DEFAULT_FOCUS);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  /** Vrai quand la date vient de la photo : on le dit, pour que la personne sache d'où elle sort et qu'elle peut la corriger. */
  protected readonly dateFromPhoto = signal(false);
  protected readonly confirmingClear = signal(false);

  protected readonly localCount = this.store.localCount;
  protected readonly readyPhoto = computed(() => {
    const state = this.photo();
    return state.status === 'ready' ? state.photo : null;
  });
  protected readonly loading = computed(() => this.photo().status === 'loading');
  protected readonly photoError = computed(() => {
    const state = this.photo();
    return state.status === 'error' ? state.message : '';
  });
  protected readonly canSubmit = computed(() => this.readyPhoto() !== null && !this.saving());

  protected async onFileChosen(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Vidé pour que choisir de nouveau la même photo déclenche l'événement.
    input.value = '';
    if (!file) return;

    this.photo.set({ status: 'loading' });
    try {
      const [photo, date] = await Promise.all([preparePhoto(file), photoDateOf(file)]);
      this.photo.set({ status: 'ready', photo });
      this.focus.set(DEFAULT_FOCUS);

      // Une date saisie à la main n'est jamais écrasée.
      const { year, month, day } = this.form.controls;
      if (!year.dirty && !month.dirty && !day.dirty) {
        this.form.patchValue(splitDate(date));
        this.dateFromPhoto.set(!!date);
      }
    } catch (error) {
      const message = error instanceof PhotoError ? error.message : 'Impossible de lire cette photo.';
      console.error('[memory-form] photo refusée', error);
      this.photo.set({ status: 'error', message });
    }
  }

  /** Le message sur la date (année, mois, jour), ou une chaîne vide quand tout va bien ou que rien n'a encore été touché. */
  protected dateError(): string {
    const { year, month, day } = this.form.controls;
    const touched = year.touched || month.touched || day.touched;
    if (!touched) return '';

    if (year.hasError('required')) return 'Indique au moins l’année.';
    if (year.hasError('min') || year.hasError('max')) return `L’année doit être entre ${EARLIEST_YEAR} et ${this.thisYear}.`;
    if (day.hasError('min') || day.hasError('max')) return 'Le jour doit être entre 1 et 31.';
    if (this.form.hasError('dayWithoutMonth')) return 'Choisis aussi le mois pour préciser le jour.';
    if (this.form.hasError('impossibleDate')) return 'Cette date n’existe pas.';
    if (this.form.hasError('futureDate')) return 'Cette date est dans le futur.';
    return '';
  }

  protected async submit() {
    const photo = this.readyPhoto();
    this.form.markAllAsTouched();
    if (this.form.invalid || !photo || this.saving()) return;

    this.saving.set(true);
    this.saveError.set('');
    try {
      const { title, description, year, month, day } = this.form.getRawValue();
      const memory = await this.store.add({
        title: title.trim(),
        description: description.trim(),
        image: photo.dataUrl,
        date: buildDate({ year, month, day }),
        focus: this.focus(),
      });
      this.dialogRef.close(memory.id);
    } catch (error) {
      console.error('[memory-form] enregistrement impossible', error);
      this.saveError.set('Impossible d’enregistrer ce souvenir sur cet appareil (espace insuffisant, navigation privée ?).');
      this.saving.set(false);
    }
  }

  /** Deux clics pour effacer : le premier demande confirmation. */
  protected async clearLocal() {
    if (!this.confirmingClear()) {
      this.confirmingClear.set(true);
      return;
    }
    await this.store.clearLocal();
    this.confirmingClear.set(false);
  }
}

const PROBLEMS: Record<string, string> = {
  'day-without-month': 'dayWithoutMonth',
  impossible: 'impossibleDate',
  future: 'futureDate',
};

/** Vérifie que l'année, le mois et le jour forment ensemble une date qui existe et n'est pas dans le futur. */
function dateValidator(group: AbstractControl): ValidationErrors | null {
  const { year, month, day } = (group as FormGroup).getRawValue() as { year: number | null; month: number | null; day: number | null };
  const problem = dateProblem({ year, month, day });
  return problem ? { [PROBLEMS[problem]]: true } : null;
}
