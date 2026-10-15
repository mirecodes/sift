import { useEffect, useMemo, useRef, useState } from 'react';
import type { ItemDef } from '../../../shared/content/schema';
import { APP_VERSION } from '../../app/version';
import type { AnimalSpecies } from '../../domain/animals/catalog';
import { content } from '../../domain/content';
import { chosenSkins, ownedThemes, skinChoices } from '../../domain/cosmetics/inventory';
import { BuySheet } from '../shop/ShopScreen';
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

/**
 * Skins of one species as floating picture cards (owner request, ADR-043, DESIGN.md 7.5): owned ones
 * toggle in and out of the choice (several allowed), the others open the buy sheet.
 */
export function SpeciesSheet({ species, onClose }: { species: AnimalSpecies; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cosmetics = useApp((s) => s.cosmetics);
  const equipped = useApp((s) => s.equipped);
  const toggleSkin = useApp((s) => s.toggleSkin);
  const chooseSkins = useApp((s) => s.chooseSkins);
  const [buying, setBuying] = useState<ItemDef | null>(null);
  const choices = useMemo(() => skinChoices(species.id, cosmetics, Date.now(), APP_VERSION), [species.id, cosmetics]);
  const chosen = chosenSkins(equipped, species.id);
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog ref={ref} className={`${styles.sheet} ${styles.wideSheet}`} onClose={onClose} aria-labelledby="species-title">
      <div className={styles.sheetHead}>
        <h2 id="species-title" className="type-display-sm">
          {species.name}
        </h2>
        <TierBadge rank={species.tierRank} />
        <IconButton aria-label={strings.aria.close} onClick={() => ref.current?.close()}>
          <CloseIcon />
        </IconButton>
      </div>
      <div className={styles.sheetBar}>
        <p className={`${styles.hint} type-body-sm`}>{strings.collection.skinsHint}</p>
        <Button variant="secondary" className={styles.small} onClick={() => void chooseSkins(species.id, choices.filter((c) => c.owned).map((c) => c.id))}>
          {strings.collection.selectAll}
        </Button>
      </div>
      <ul className={styles.skinGrid} aria-label={strings.collection.skinsOf(species.name)}>
        {choices.map((c) => {
          const name = c.id === DEFAULT_SKIN ? strings.collection.defaultSkin : nameOf(c.id);
          const on = chosen.includes(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                className={c.owned ? styles.skinCard : `${styles.skinCard} ${styles.notOwned}`}
                aria-pressed={c.owned ? on : undefined}
                aria-label={c.owned ? name : strings.collection.buySkin(name, c.price ?? 0)}
                onClick={() => (c.owned ? void toggleSkin(species.id, c.id) : setBuying(content.get(c.id) as ItemDef))}
              >
                <span className={styles.skinArt}>
                  <ItemSprite id={c.id === DEFAULT_SKIN ? species.id : c.id} size={96} />
                </span>
                <span className={`${styles.skinName} type-caption`}>{name}</span>
                {!c.owned && (
                  <span className={`${styles.skinPrice} type-caption`}>
                    <GoldIcon />
                    {c.price}
                  </span>
                )}
                {on && <span className={styles.check} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      {buying && <BuySheet item={buying} onClose={() => setBuying(null)} />}
    </dialog>
  );
}
