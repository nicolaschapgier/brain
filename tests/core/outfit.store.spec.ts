import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OutfitStore } from '@core/outfit.store';

function createStore() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { store: TestBed.inject(OutfitStore), http: TestBed.inject(HttpTestingController) };
}

describe('OutfitStore', () => {
  it('charge les tenues du JSON', () => {
    const { store, http } = createStore();
    expect(store.status()).toBe('loading');

    http.expectOne('data/outfits.json').flush([{ title: 'Maillot orange', image: 'a.svg' }]);

    expect(store.status()).toBe('ready');
    expect(store.outfits().map((o) => o.title)).toEqual(['Maillot orange']);
  });

  it('passe en erreur si le JSON ne charge pas, et peut réessayer', () => {
    const { store, http } = createStore();
    http.expectOne('data/outfits.json').error(new ProgressEvent('erreur réseau'));
    expect(store.status()).toBe('error');

    store.load();
    http.expectOne('data/outfits.json').flush([{ title: 'OK', image: 'a.svg' }]);
    expect(store.status()).toBe('ready');
    expect(store.outfits()).toHaveLength(1);
  });
});
