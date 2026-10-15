import { content } from '../../domain/content';
import { getSpecies } from '../../domain/animals/catalog';
import { VoxelSprite } from './VoxelSprite';
import styles from './ItemSprite.module.css';

interface Props {
  /** Species, skin, block theme or building id. */
  id: string;
  /** CSS size in px (sprites are 48 px; whole multiples stay crisp). */
  size?: number;
  /** Solid grey shape (species not collected yet). */
  silhouette?: boolean;
}

/**
 * The generated pixel-art sprite of an item (Step 3.5, atlas from `npm run content:sprites`), scaled
 * with nearest-neighbor. Species without an atlas frame (e.g. a pack that arrived without sprites)
 * fall back to the flat front-view sprite.
 */
export function ItemSprite({ id, size = 96, silhouette }: Props) {
  const sprite = content.sprite(id);
  if (!sprite) {
    const item = content.get(id);
    const speciesId = item?.kind === 'species' ? item.id : item?.kind === 'animalSkin' ? item.speciesId : undefined;
    return speciesId ? <VoxelSprite modelId={getSpecies(speciesId).modelId} size={size} silhouette={silhouette} /> : <span style={{ width: size, height: size }} />;
  }
  const k = size / sprite.size;
  return (
    <span
      className={silhouette ? `${styles.sprite} ${styles.silhouette}` : styles.sprite}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${sprite.image})`,
        backgroundPosition: `${-sprite.x * k}px ${-sprite.y * k}px`,
        backgroundSize: `${sprite.width * k}px ${sprite.height * k}px`,
      }}
    />
  );
}
