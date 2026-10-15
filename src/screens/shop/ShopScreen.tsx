import { useEffect, useMemo, useRef, useState } from 'react';
import type { ItemDef } from '../../../shared/content/schema';
import { APP_VERSION } from '../../app/version';
import { DEFAULT_SKIN } from '../../domain/island/model';
import { ownedCount } from '../../domain/cosmetics/inventory';
import { itemBadges, shopView } from '../../domain/cosmetics/shop';
import { selectDiscoveredSpecies, useApp } from '../../store';
import { strings } from '../../ui/strings';
import { usePrefersReducedMotion } from '../../ui/hooks';
import { Button, IconButton } from '../../ui/components/Button';
import { CloseIcon, GoldIcon } from '../../ui/components/Icons';
import { FeatureCard } from '../../ui/components/Surfaces';
import { TopBar } from '../../ui/components/TopBar';
import { ItemPreview } from '../../world/preview/ItemPreview';
import { ItemSprite } from '../collection/ItemSprite';
import { GoldBalance } from '../home/Hud';
import page from '../Screen.module.css';
import styles from './Shop.module.css';

/** The Shop (guidance_v2 Step 3.9, DESIGN.md 7.7): featured, skins, themes, buildings; buy with gold. */
export function ShopScreen() {
  const setView = useApp((s) => s.setView);
  const animals = useApp((s) => s.animals);
  const [buying, setBuying] = useState<ItemDef | null>(null);
  // The clock is read once per visit: badges and availability do not tick while the page is open.
  const now = useMemo(() => Date.now(), []);
  const discovered = useMemo(() => selectDiscoveredSpecies({ animals }), [animals]);
  const view = useMemo(() => shopView({ now, clientVersion: APP_VERSION, discovered }), [now, discovered]);

  const grid = (items: readonly ItemDef[]) => (
    <ul className={styles.grid}>
      {items.map((item) => (
        <li key={item.id}>
          <ItemCard item={item} now={now} onBuy={() => setBuying(item)} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className={page.page}>
      <TopBar start={<GoldBalance />}>
        <IconButton aria-label={strings.aria.close} onClick={() => setView('home')}>
          <CloseIcon />
        </IconButton>
      </TopBar>
      <main className={`${page.content} ${styles.wide}`}>
        <h1 className={`${page.title} type-display-md`}>{strings.shop.title}</h1>

        {view.featured && view.featured.items.length > 0 && (
          <section className={styles.section} aria-labelledby="shop-featured">
            <h2 id="shop-featured" className={`${styles.eyebrow} type-eyebrow`}>
              {strings.shop.featured(view.featured.release.name.en)}
            </h2>
            <ul className={styles.row}>
              {view.featured.items.map((item) => (
                <li key={item.id}>
                  <ItemCard item={item} now={now} onBuy={() => setBuying(item)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.section} aria-labelledby="shop-skins">
          <h2 id="shop-skins" className="type-display-xs">{strings.shop.skins}</h2>
          {view.skins.length ? grid(view.skins) : <p className={`${styles.note} type-body-md`}>{strings.shop.noSkins}</p>}
        </section>

        <section className={styles.section} aria-labelledby="shop-themes">
          <h2 id="shop-themes" className="type-display-xs">{strings.shop.themes}</h2>
          {grid(view.themes)}
        </section>

        <section className={styles.section} aria-labelledby="shop-buildings">
          <h2 id="shop-buildings" className="type-display-xs">{strings.shop.buildings}</h2>
          {view.buildings.map((g) => (
            <div key={g.category}>
              <h3 className={`${styles.eyebrow} type-eyebrow-sm`}>{strings.shop.categories[g.category]}</h3>
              {grid(g.items)}
            </div>
          ))}
        </section>
      </main>
      {buying && <BuySheet item={buying} onClose={() => setBuying(null)} />}
    </div>
  );
}

function ItemCard({ item, now, onBuy }: { item: ItemDef; now: number; onBuy: () => void }) {
  const gold = useApp((s) => s.gold);
  const owned = useApp((s) => ownedCount(s.cosmetics, item.id));
  const badges = itemBadges(item, now);
  const price = item.price ?? 0;
  const ownedOnce = item.kind !== 'building' && owned > 0;
  const short = price - gold;
  return (
    <FeatureCard className={styles.card}>
      <ItemSprite id={item.id} size={96} />
      <p className={`${styles.name} type-body-md-strong`}>{item.name.en}</p>
      {(badges.isNew || badges.leavesInMs !== undefined) && (
        <p className={styles.badges}>
          {badges.isNew && <span className={`${styles.badge} ${styles.new} type-caption`}>{strings.shop.new}</span>}
          {badges.leavesInMs !== undefined && <span className={`${styles.badge} ${styles.limited} type-caption`}>{strings.shop.leavesIn(badges.leavesInMs)}</span>}
        </p>
      )}
      <p className={`${styles.price} type-body-sm-strong`} aria-label={strings.shop.price(price)}>
        <GoldIcon />
        <span aria-hidden="true">{price}</span>
      </p>
      {item.kind === 'building' && owned > 0 && <p className={`${styles.owned} type-caption`}>{strings.shop.ownedCount(owned)}</p>}
      <Button variant="secondary" disabled={ownedOnce || short > 0} onClick={onBuy} aria-label={ownedOnce || short > 0 ? undefined : strings.shop.buyName(item.name.en)}>
        {ownedOnce ? strings.shop.owned : short > 0 ? strings.shop.needMore(short) : strings.shop.buy}
      </Button>
    </FeatureCard>
  );
}

/** Confirm, buy, then offer to equip (skins, themes) or point to build mode (buildings). */
function BuySheet({ item, onClose }: { item: ItemDef; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const gold = useApp((s) => s.gold);
  const buyItem = useApp((s) => s.buyItem);
  const equipSkin = useApp((s) => s.equipSkin);
  const equipTheme = useApp((s) => s.equipTheme);
  const reducedMotion = usePrefersReducedMotion();
  const [state, setState] = useState<'confirm' | 'busy' | 'done' | 'failed'>('confirm');
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const close = () => ref.current?.close();

  const buy = async () => {
    setState('busy');
    try {
      await buyItem(item.id);
      setState('done');
    } catch {
      setState('failed');
    }
  };
  const equip = async () => {
    if (item.kind === 'animalSkin') await equipSkin(item.speciesId, item.id);
    else if (item.kind === 'blockTheme') await equipTheme(item.id);
    close();
  };

  return (
    <dialog ref={ref} className={styles.sheet} onClose={onClose} aria-labelledby="buy-title">
      <div className={styles.sheetHead}>
        <h2 id="buy-title" className="type-display-sm">
          {state === 'done' ? strings.shop.bought : strings.shop.confirmTitle(item.name.en)}
        </h2>
        <IconButton aria-label={strings.aria.close} onClick={close}>
          <CloseIcon />
        </IconButton>
      </div>
      <ItemPreview id={item.id} reducedMotion={reducedMotion} />
      {state === 'done' ? (
        <>
          {item.kind === 'building' && <p className="type-body-md">{strings.shop.placeHint}</p>}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={close}>
              {strings.shop.done}
            </Button>
            {item.kind !== 'building' && item.id !== DEFAULT_SKIN && <Button onClick={() => void equip()}>{strings.shop.equip}</Button>}
          </div>
        </>
      ) : (
        <>
          <p className="type-body-md">{strings.shop.confirmBody(item.price ?? 0, gold)}</p>
          {state === 'failed' && <p className={`${styles.error} type-body-sm`}>{strings.shop.failed}</p>}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={close}>
              {strings.shop.cancel}
            </Button>
            <Button onClick={() => void buy()} disabled={state === 'busy'}>
              {strings.shop.buy}
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
