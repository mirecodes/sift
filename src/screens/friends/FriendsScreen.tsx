import { useEffect, useState } from 'react';
import type { PersonView } from '../../../shared/api/types';
import { balance } from '../../../shared/balance/balance';
import { deepLinkUrl } from '../../../shared/rules/links';
import { formatHandle, nameProblem } from '../../../shared/rules/handle';
import { runtimeConfig } from '../../app/runtimeConfig';
import { useApp } from '../../store';
import { useNow } from '../../ui/hooks';
import { strings } from '../../ui/strings';
import { Button, IconButton } from '../../ui/components/Button';
import { TextField } from '../../ui/components/Controls';
import { FeatureCard } from '../../ui/components/Surfaces';
import { SignInSheet } from '../account/SignInSheet';
import { TabPage } from '../TabPage';
import { AddFriendSheet, errorText, PersonMenu } from './FriendSheets';
import { Avatar, FocusingNow, HandleText, PersonRow } from './Person';
import { TogetherInviteSheet } from './TogetherSheets';
import styles from './Friends.module.css';

/** Step 7.1: required before anything social; the shared rule gives instant feedback. */
function ChooseName() {
  const setHandle = useApp((s) => s.setHandle);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const problem = value ? nameProblem(value) : null;
  const save = async () => {
    const outcome = await setHandle(value);
    setError(outcome ? (outcome === 'handle_invalid' ? strings.friends.nameProblems.reserved : errorText(outcome)) : '');
  };
  return (
    <FeatureCard className={styles.card}>
      <h2 className="type-display-xs">{strings.friends.chooseTitle}</h2>
      <p className={`${styles.muted} type-body-sm`}>{strings.friends.chooseHint}</p>
      <form
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          if (!problem) void save();
        }}
      >
        <TextField label={strings.friends.name} value={value} onChange={setValue} maxLength={24} autoComplete="nickname" />
        {(problem || error) && (
          <p className={`${styles.error} type-body-sm`} role="alert">
            {problem ? strings.friends.nameProblems[problem] : error}
          </p>
        )}
        <div className={styles.buttons}>
          <Button type="submit" disabled={!value || !!problem}>
            {strings.friends.save}
          </Button>
        </div>
      </form>
    </FeatureCard>
  );
}

/** Copies text, or shares a link through the share sheet where there is one. */
async function share(text: string, url: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return true;
    } catch {
      return false;
    }
  }
  await navigator.clipboard?.writeText(`${text} ${url}`).catch(() => undefined);
  return true;
}

function Header({ me, onAdd }: { me: NonNullable<PersonView['handle']>; onAdd: () => void }) {
  const avatar = useApp((s) => s.animals.filter((a) => a.status === 'active').at(-1)?.speciesId ?? null);
  const [copied, setCopied] = useState(false);
  const handle = formatHandle(me);
  const link = deepLinkUrl(runtimeConfig.links.origin || location.origin, { kind: 'add', ...me });
  return (
    <FeatureCard className={styles.card}>
      <div className={styles.me}>
        <Avatar speciesId={avatar} />
        <span className={styles.who}>
          <HandleText handle={me} />
        </span>
        <span className={styles.buttons}>
          <Button
            variant="secondary"
            className={styles.small}
            onClick={async () => {
              await navigator.clipboard?.writeText(handle).catch(() => undefined);
              setCopied(true);
            }}
          >
            {copied ? strings.friends.copied : strings.friends.copy}
          </Button>
          <Button variant="secondary" className={styles.small} onClick={() => void share(strings.friends.shareText(handle), link)}>
            {strings.friends.share}
          </Button>
        </span>
      </div>
      <Button onClick={onAdd}>{strings.friends.addFriend}</Button>
    </FeatureCard>
  );
}

/** The Friends tab (Step 7.3, DESIGN.md 7.11). */
export function FriendsScreen() {
  const status = useApp((s) => s.account.status);
  const social = useApp((s) => s.social);
  const socialStatus = useApp((s) => s.socialStatus);
  const refresh = useApp((s) => s.refreshSocial);
  const respond = useApp((s) => s.respondFriend);
  const cancel = useApp((s) => s.cancelFriend);
  const unblock = useApp((s) => s.unblockUser);
  const visitIsland = useApp((s) => s.visitIsland);
  const prefetch = useApp((s) => s.prefetchIsland);
  const now = useNow(60_000);
  const takeLink = useApp((s) => s.takeLink);
  const hasLink = useApp((s) => s.pendingLink?.kind === 'add');
  const [sheet, setSheet] = useState<{ kind: 'add'; initial?: string } | { kind: 'menu'; person: PersonView } | { kind: 'together'; userId: string } | { kind: 'signIn' } | null>(null);
  const [error, setError] = useState('');

  // Opened from a friend link (`/add/name-tag`, Step 6.5): the request is ready to send once named.
  const named = !!social?.me.handle;
  useEffect(() => {
    if (!hasLink || !named) return;
    const link = takeLink('add');
    if (link) setSheet({ kind: 'add', initial: formatHandle(link) });
  }, [hasLink, named, takeLink]);

  // Load on open and keep presence fresh while the tab is shown (presence is polled, ADR-047).
  useEffect(() => {
    if (status !== 'signedIn') return;
    void refresh();
    const id = setInterval(() => void refresh(), balance.social.presencePollMs);
    return () => clearInterval(id);
  }, [status, refresh]);

  let body: JSX.Element;
  if (status !== 'signedIn') {
    body = (
      <FeatureCard className={styles.card}>
        <p className="type-body-md">{strings.friends.signedOut}</p>
        <div className={styles.buttons}>
          <Button onClick={() => setSheet({ kind: 'signIn' })}>{strings.account.signIn}</Button>
        </div>
      </FeatureCard>
    );
  } else if (!social) {
    body =
      socialStatus === 'offline' ? (
        <FeatureCard className={styles.card}>
          <p className="type-body-md">{strings.friends.offline}</p>
          <div className={styles.buttons}>
            <Button variant="secondary" onClick={() => void refresh()}>
              {strings.friends.retry}
            </Button>
          </div>
        </FeatureCard>
      ) : (
        <p className={`${styles.muted} type-body-md`}>{strings.friends.loading}</p>
      );
  } else if (!social.me.handle) {
    body = <ChooseName />;
  } else {
    const requests = social.incoming.length + social.outgoing.length;
    body = (
      <>
        <Header me={social.me.handle} onAdd={() => setSheet({ kind: 'add' })} />
        {error && (
          <p className={`${styles.error} type-body-sm`} role="alert">
            {error}
          </p>
        )}
        {requests > 0 && (
          <section className={styles.section}>
            <h2 className="type-eyebrow">{strings.friends.requests(requests)}</h2>
            <ul className={styles.list}>
              {social.incoming.map((p) => (
                <PersonRow key={p.userId} person={p}>
                  <Button className={styles.small} onClick={() => void respond(p.userId, true)}>
                    {strings.friends.accept}
                  </Button>
                  <Button variant="secondary" className={styles.small} onClick={() => void respond(p.userId, false)}>
                    {strings.friends.decline}
                  </Button>
                </PersonRow>
              ))}
              {social.outgoing.map((p) => (
                <PersonRow key={p.userId} person={p} sub={<span className={`${styles.muted} type-caption`}>{strings.friends.sent}</span>}>
                  <Button variant="secondary" className={styles.small} onClick={() => void cancel(p.userId)}>
                    {strings.friends.cancel}
                  </Button>
                </PersonRow>
              ))}
            </ul>
          </section>
        )}
        <section className={styles.section}>
          <h2 className="type-eyebrow">{strings.friends.list(social.friends.length)}</h2>
          {social.friends.length === 0 ? (
            <p className={`${styles.muted} type-body-sm`}>{strings.friends.empty}</p>
          ) : (
            <ul className={styles.list}>
              {social.friends.map((p) => (
                <PersonRow key={p.userId} person={p} sub={p.focusing ? <FocusingNow label={strings.friends.focusingNow} /> : undefined}>
                  <Button
                    variant="secondary"
                    className={styles.small}
                    onPointerEnter={() => prefetch(p.userId)}
                    onPointerDown={() => prefetch(p.userId)}
                    onClick={async () => {
                      const outcome = await visitIsland(p.userId);
                      setError(outcome ? errorText(outcome) : '');
                    }}
                  >
                    {strings.friends.visit}
                  </Button>
                  {runtimeConfig.features.together && (
                    <Button variant="secondary" className={styles.small} onClick={() => setSheet({ kind: 'together', userId: p.userId })}>
                      {strings.friends.together}
                    </Button>
                  )}
                  <IconButton aria-label={strings.friends.more(p.handle ? formatHandle(p.handle) : '')} onClick={() => setSheet({ kind: 'menu', person: p })}>
                    <span aria-hidden="true">⋯</span>
                  </IconButton>
                </PersonRow>
              ))}
            </ul>
          )}
        </section>
        {social.visitors.length > 0 && (
          <section className={styles.section}>
            <h2 className="type-eyebrow">{strings.friends.visitors}</h2>
            <ul className={styles.list}>
              {social.visitors.map((v) => (
                <PersonRow key={v.person.userId} person={v.person} sub={<span className={`${styles.muted} type-caption`}>{strings.friends.ago(now - v.at)}</span>} />
              ))}
            </ul>
          </section>
        )}
        {social.blocked.length > 0 && (
          <section className={styles.section}>
            <h2 className="type-eyebrow">{strings.friends.blocked}</h2>
            <ul className={styles.list}>
              {social.blocked.map((p) => (
                <PersonRow key={p.userId} person={p}>
                  <Button variant="secondary" className={styles.small} onClick={() => void unblock(p.userId)}>
                    {strings.friends.unblock}
                  </Button>
                </PersonRow>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }

  return (
    <TabPage title={strings.friends.title}>
      {body}
      {sheet?.kind === 'add' && <AddFriendSheet {...(sheet.initial && { initial: sheet.initial })} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'menu' && <PersonMenu person={sheet.person} context="friends" friend onClose={() => setSheet(null)} />}
      {sheet?.kind === 'together' && <TogetherInviteSheet preselect={[sheet.userId]} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'signIn' && <SignInSheet onClose={() => setSheet(null)} />}
    </TabPage>
  );
}
