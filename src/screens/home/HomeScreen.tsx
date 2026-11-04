import { platform } from '../../platform';
import { useApp } from '../../store';
import { useSpaceKey } from '../../ui/hooks';
import { strings } from '../../ui/strings';
import { Button, IconButton } from '../../ui/components/Button';
import { BuildIcon, CollectionIcon, SettingsIcon } from '../../ui/components/Icons';
import { Panel } from '../../ui/components/Surfaces';
import { TopBar } from '../../ui/components/TopBar';
import { NoticeCard } from '../NoticeCard';
import { runtimeConfig } from '../../app/runtimeConfig';
import { Hud } from './Hud';
import { FriendsFocusing } from '../friends/Together';
import layer from '../Screen.module.css';
import styles from './HomeScreen.module.css';

const { features } = runtimeConfig;

export function HomeScreen() {
  const settings = useApp((s) => s.settings);
  const startFocus = useApp((s) => s.startFocus);
  const setView = useApp((s) => s.setView);

  const start = () => {
    platform.notify.unlock(); // audio may only start from a user gesture
    void startFocus();
  };
  useSpaceKey(start);

  return (
    <div className={layer.layer}>
      <div className={styles.top}>
        <TopBar start={features.economy && <Hud />}>
          {(features.cosmetics || features.arrange) && (
            <IconButton aria-label={strings.aria.build} onClick={() => setView('build')}>
              <BuildIcon />
            </IconButton>
          )}
          <IconButton aria-label={strings.aria.collection} onClick={() => setView('collection')}>
            <CollectionIcon />
          </IconButton>
          <IconButton aria-label={strings.aria.settings} onClick={() => setView('settings')}>
            <SettingsIcon />
          </IconButton>
        </TopBar>
      </div>
      <NoticeCard />
      <Panel className={styles.panel}>
        <p className={`${styles.cycle} type-eyebrow`}>{strings.home.cycle(settings.focusMinutes, settings.breakMinutes)}</p>
        <Button block onClick={start}>
          {strings.home.start}
        </Button>
        {features.presence && <FriendsFocusing />}
      </Panel>
    </div>
  );
}
