import { useEffect, useMemo, useRef } from 'react';
import { APP_VERSION } from '../../app/version';
import type { AnimalSpecies } from '../../domain/animals/catalog';
import { content } from '../../domain/content';
import { ownedThemes, skinChoices } from '../../domain/cosmetics/inventory';
import { DEFAULT_SKIN } from '../../domain/island/model';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { TierBadge } from '../../ui/components/Badge';
import { Button, IconButton } from '../../ui/components/Button';
import { CloseIcon, GoldIcon } from '../../ui/components/Icons';
import { ItemSprite } from './ItemSprite';
import styles from './CollectionScreen.module.css';

const nameOf = (id: string) => {
  const item = content.get(id);
  return item && 'name' in item ? item.name.en : id;
};

/** Owned block themes; a tap equips one and the island changes at once (DESIGN.md 7.5). */
export function ThemePicker() {
  const cosmetics = useApp((s) => s.cosmetics);
  const current = useApp((s) => s.equipped.blockThemeId);
  const equipTheme = useApp((s) => s.equipTheme);
  const themes = useMemo(() => ownedThemes(cosmetics), [cosmetics]);
  return (
    <section aria-labelledby="theme-title">
      <h2 id="theme-title" className={`${styles.eyebrow} type-eyebrow`}>
        {strings.collection.theme}
      </h2>
      <div className={styles.themes}>
        {themes.map((id) => (
          <button key={id} type="button" className={styles.theme} aria-pressed={id === current} onClick={() => void equipTheme(id)}>
            <ItemSprite id={id} size={48} />
            <span className="type-caption">{nameOf(id)}</span>
          </button>
        ))}
      </div>
      {themes.length === 1 && <p className={`${styles.hint} type-body-sm`}>{strings.collection.moreThemes}</p>}
    </section>
  );
}

/** Skins of one species: equip owned ones, or go to the shop for the others (DESIGN.md 7.5). */
export function SpeciesSheet({ species, onClose }: { species: AnimalSpecies; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cosmetics = useApp((s) => s.cosmetics);
  const equippedId = useApp((s) => s.equipped.skinBySpecies[species.id] ?? DEFAULT_SKIN);
  const equipSkin = useApp((s) => s.equipSkin);
  const setView = useApp((s) => s.setView);
  const choices = useMemo(() => skinChoices(species.id, cosmetics, Date.now(), APP_VERSION), [species.id, cosmetics]);
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog ref={ref} className={styles.sheet} onClose={onClose} aria-labelledby="species-title">
      <div className={styles.sheetHead}>
        <h2 id="species-title" className="type-display-sm">
          {species.name}
        </h2>
        <TierBadge rank={species.tierRank} />
        <IconButton aria-label={strings.aria.close} onClick={() => ref.current?.close()}>
          <CloseIcon />
        </IconButton>
      </div>
      <ul className={styles.skins} aria-label={strings.collection.skinsOf(species.name)}>
        {choices.map((c) => {
          const name = c.id === DEFAULT_SKIN ? strings.collection.defaultSkin : nameOf(c.id);
          return (
            <li key={c.id} className={styles.skin}>
              <ItemSprite id={c.id === DEFAULT_SKIN ? species.id : c.id} size={48} />
              <span className="type-body-md-strong">{name}</span>
              <span className={styles.skinAction}>
                {c.id === equippedId ? (
                  <span className={`${styles.hint} type-caption`}>{strings.collection.equipped}</span>
                ) : c.owned ? (
                  <Button variant="secondary" aria-label={`${strings.collection.equip} ${name}`} onClick={() => void equipSkin(species.id, c.id)}>
                    {strings.collection.equip}
                  </Button>
                ) : (
                  <>
                    <span className={`${styles.price} type-body-sm-strong`} aria-label={strings.shop.price(c.price ?? 0)}>
                      <GoldIcon />
                      <span aria-hidden="true">{c.price}</span>
                    </span>
                    <Button variant="secondary" onClick={() => setView('shop')}>
                      {strings.collection.openShop}
                    </Button>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
