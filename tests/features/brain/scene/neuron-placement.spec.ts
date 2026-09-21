import { Memory } from '@core/memory.model';
import { NEURON_SPAN, placeNeurons } from '@features/brain/scene/neuron-placement';

const memory = (id: string, position?: Memory['position']): Memory => ({
  id,
  title: id,
  description: '',
  image: '',
  position,
});

describe('placeNeurons', () => {
  const memories = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => memory(id));

  it('est déterministe', () => {
    expect(placeNeurons(memories).map((p) => p.toArray())).toEqual(placeNeurons(memories).map((p) => p.toArray()));
  });

  it("garde les neurones dans l'ellipsoïde du cerveau", () => {
    for (const p of placeNeurons(memories)) {
      expect((p.x / NEURON_SPAN.x) ** 2 + (p.y / NEURON_SPAN.y) ** 2 + (p.z / NEURON_SPAN.z) ** 2).toBeLessThanOrEqual(1);
    }
  });

  it('espace les neurones les uns des autres', () => {
    const positions = placeNeurons(memories, 1.2);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        expect(positions[i].distanceTo(positions[j])).toBeGreaterThan(0.8);
      }
    }
  });

  it('respecte la position fournie dans le JSON', () => {
    const [forced] = placeNeurons([memory('x', [0.5, 0, -1])]);
    expect(forced.toArray()).toEqual([0.5 * NEURON_SPAN.x, 0, -NEURON_SPAN.z]);
  });

  it('ne déplace pas un neurone déjà placé quand on en ajoute à la fin', () => {
    const before = placeNeurons(memories);
    const after = placeNeurons([...memories, memory('g')]);
    before.forEach((p, i) => expect(after[i].toArray()).toEqual(p.toArray()));
  });
});
