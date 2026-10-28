import { useEffect, useRef, useState } from 'react';
import type { GroupView, MemberView } from '../../../shared/api/types';
import { balance } from '../../../shared/balance/balance';
import { formatHandle, groupNameProblem } from '../../../shared/rules/handle';
import { deepLinkUrl } from '../../../shared/rules/links';
import { formatScore } from '../../../shared/rules/scoring';
import { runtimeConfig } from '../../app/runtimeConfig';
import { formatDuration } from '../../domain/stats/stats';
import { useApp } from '../../store';
import type { Outcome } from '../../store/social';
import { useNow } from '../../ui/hooks';
import { strings } from '../../ui/strings';
import { Button, IconButton } from '../../ui/components/Button';
import { Segmented, TextField } from '../../ui/components/Controls';
import { Sheet, sheetStyles, type SheetHandle } from '../../ui/components/Sheet';
import { FeatureCard } from '../../ui/components/Surfaces';
import { SignInSheet } from '../account/SignInSheet';
import { ReportSheet } from '../friends/FriendSheets';
import { FocusingNow, PersonRow } from '../friends/Person';
import { TabPage } from '../TabPage';
import { WarsTab } from './WarsTab';
import { AttackSheet } from './WarSheets';
import f from '../friends/Friends.module.css';
import styles from './Group.module.css';

const { features } = runtimeConfig;
const errorText = (code: Outcome): string => (code ? (strings.group.errors[code] ?? strings.group.errors.generic!) : '');
const handleText = (m: MemberView) => (m.person.handle ? formatHandle(m.person.handle) : '…');

function Crown() {
  return (
    <svg className={styles.crown} viewBox="0 0 16 16" aria-label={strings.group.champion} role="img">
      <path d="M2 12 L3 5 L6 8 L8 3 L10 8 L13 5 L14 12 Z" fill="currentColor" stroke="var(--color-ink)" strokeWidth="1" />
    </svg>
  );
}

/** No group yet: create, join with a code, or answer an invite (Step 8.2). */
function NoGroup() {
  const createGroup = useApp((s) => s.createGroup);
  const joinGroup = useApp((s) => s.joinGroup);
  const respond = useApp((s) => s.respondGroupInvite);
  const invites = useApp((s) => s.groupInvites);
  const rejoinAt = useApp((s) => s.rejoinAt);
  const takeLink = useApp((s) => s.takeLink);
  const now = useNow(60_000);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const link = takeLink('join');
    if (link) setCode(link.code);
  }, [takeLink]);
  const waiting = rejoinAt !== null && rejoinAt > now;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const problem = name ? groupNameProblem(name) : null;
  const go = async (p: Promise<Outcome>) => setError(errorText(await p));
  return (
    <div className={styles.stack}>
      {waiting && <p className={`${f.muted} type-body-sm`}>{strings.group.cooldown(Math.ceil((rejoinAt! - now) / 3_600_000))}</p>}
      {error && (
        <p className={`${f.error} type-body-sm`} role="alert">
          {error}
        </p>
      )}
      <FeatureCard className={f.card}>
        <h2 className="type-display-xs">{strings.group.createTitle}</h2>
        <TextField label={strings.group.groupName} value={name} onChange={setName} maxLength={30} />
        {problem && <p className={`${f.error} type-body-sm`}>{strings.group.errors.handle_invalid}</p>}
        <p className={`${f.muted} type-body-sm`}>{strings.group.weekHint(zone)}</p>
        <div className={f.buttons}>
          <Button disabled={waiting || !name || !!problem} onClick={() => void go(createGroup(name))}>
            {strings.group.create}
          </Button>
        </div>
      </FeatureCard>
      <FeatureCard className={f.card}>
        <h2 className="type-display-xs">{strings.group.joinTitle}</h2>
        <TextField label={strings.group.code} value={code} onChange={(v) => setCode(v.toUpperCase())} maxLength={8} autoComplete="off" />
        <div className={f.buttons}>
          <Button disabled={waiting || code.length !== balance.social.inviteCodeLength} onClick={() => void go(joinGroup(code))}>
            {strings.group.join}
          </Button>
        </div>
      </FeatureCard>
      {invites.length > 0 && (
        <section>
          <h2 className="type-eyebrow">{strings.group.invites}</h2>
          <ul className={f.list}>
            {invites.map((inv) => (
              <PersonRow
                key={inv.id}
                person={inv.inviter}
                sub={
                  <span className={`${f.muted} type-caption`}>
                    {strings.group.inviteRow(inv.groupName, inv.memberCount)} · {strings.group.from(inv.inviter.handle ? formatHandle(inv.inviter.handle) : '…')}
                  </span>
                }
              >
                <Button className={f.small} disabled={waiting} onClick={() => void go(respond(inv.id, true))}>
                  {strings.group.join}
                </Button>
                <Button variant="secondary" className={f.small} onClick={() => void go(respond(inv.id, false))}>
                  {strings.group.decline}
                </Button>
              </PersonRow>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Owner menu: rename, code, war toggle, disband. */
function OwnerMenu({ group, onClose }: { group: GroupView; onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const rename = useApp((s) => s.renameGroup);
  const setCode = useApp((s) => s.setGroupCode);
  const setWar = useApp((s) => s.setGroupWar);
  const disband = useApp((s) => s.disbandGroup);
  const [name, setName] = useState(group.name);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const act = async (p: Promise<Outcome>) => {
    const outcome = await p;
    if (outcome) setError(errorText(outcome));
    else sheet.current?.close();
  };
  if (confirm)
    return (
      <Sheet ref={sheet} title={strings.group.disbandTitle} onClose={onClose}>
        <p className="type-body-md">{strings.group.disbandBody}</p>
        <div className={sheetStyles.actions}>
          <Button onClick={() => void act(disband())}>{strings.group.disband}</Button>
        </div>
      </Sheet>
    );
  return (
    <Sheet ref={sheet} title={group.name} onClose={onClose}>
      <TextField label={strings.group.groupName} value={name} onChange={setName} maxLength={30} />
      <div className={sheetStyles.actions}>
        <Button variant="secondary" disabled={!!groupNameProblem(name) || name === group.name} onClick={() => void act(rename(name))}>
          {strings.group.rename}
        </Button>
      </div>
      {error && <p className={`${sheetStyles.error} type-body-sm`}>{error}</p>}
      <div className={sheetStyles.actions}>
        <Button variant="secondary" onClick={() => void act(setCode('regenerate'))}>
          {strings.group.newCode}
        </Button>
        <Button variant="secondary" onClick={() => void act(setCode(group.inviteCodeEnabled ? 'disable' : 'enable'))}>
          {group.inviteCodeEnabled ? strings.group.codeOffAction : strings.group.codeOnAction}
        </Button>
        {features.war && (
          <Button variant="secondary" onClick={() => void act(setWar(!group.warEnabled))}>
            {group.warEnabled ? strings.group.warOff : strings.group.warOn}
          </Button>
        )}
        <Button variant="secondary" onClick={() => setConfirm(true)}>
          {strings.group.disband}
        </Button>
      </div>
    </Sheet>
  );
}

function Header({ group, owner }: { group: GroupView; owner: boolean }) {
  const now = useNow(60_000);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = deepLinkUrl(runtimeConfig.links.origin || location.origin, { kind: 'join', code: group.inviteCode });
  const invite = async () => {
    const text = strings.group.inviteText(group.name, group.inviteCode);
    if (navigator.share) await navigator.share({ text, url: link }).catch(() => undefined);
    else {
      await navigator.clipboard?.writeText(`${text} ${link}`).catch(() => undefined);
      setCopied(true);
    }
  };
  return (
    <FeatureCard className={styles.head}>
      <div>
        <h2 className="type-display-sm">{group.name}</h2>
        <p className={`${f.muted} type-body-sm`}>
          {strings.group.members(group.members.length)} · {strings.group.settlesIn(group.week.endsAt - now)}
        </p>
      </div>
      <Button variant="secondary" className={f.small} disabled={!group.inviteCodeEnabled} onClick={() => void invite()}>
        {group.inviteCodeEnabled ? `${copied ? strings.friends.copied : strings.group.invite} · ${group.inviteCode}` : strings.group.codeOff}
      </Button>
      {owner && (
        <IconButton aria-label={strings.friends.more(group.name)} onClick={() => setMenu(true)}>
          <span aria-hidden="true">⋯</span>
        </IconButton>
      )}
      {menu && <OwnerMenu group={group} onClose={() => setMenu(false)} />}
    </FeatureCard>
  );
}

function Breakdown({ member, onClose }: { member: MemberView; onClose: () => void }) {
  const s = member.score;
  return (
    <Sheet title={strings.group.breakdownTitle(handleText(member))} onClose={onClose}>
      <ul className={`${styles.breakdown} type-body-md`}>
        {[3, 2, 1, 0].map((rank) =>
          s.activeByTier[rank] ? (
            <li key={rank}>
              <span>
                {strings.tiers[rank as 0 | 1 | 2 | 3]} ×{s.activeByTier[rank]}
              </span>
              <span>{formatScore(s.activeByTier[rank]! * (balance.scoring.tierPoints[rank] ?? 0))}</span>
            </li>
          ) : null,
        )}
        {s.lostInBattle > 0 && (
          <li>
            <span>{strings.group.lost}</span>
            <span>{formatScore(s.lostPoints)}</span>
          </li>
        )}
        <li className={`${styles.total} type-body-md-strong`}>
          <span>{strings.group.total}</span>
          <span>{formatScore(s.score)}</span>
        </li>
      </ul>
    </Sheet>
  );
}

/** Step 8.4: rank, avatar, handle, score (tap: breakdown), week focus time, presence, crown. */
function Ranking({ group, me, attack }: { group: GroupView; me: string | null; attack?: (m: MemberView) => React.ReactNode }) {
  const visit = useApp((s) => s.visitIsland);
  const prefetch = useApp((s) => s.prefetchIsland);
  const [open, setOpen] = useState<MemberView | null>(null);
  return (
    <>
      <ul className={f.list}>
        {group.members.map((m) => (
          <PersonRow
            key={m.person.userId}
            person={m.person}
            compact
            highlight={m.person.userId === me}
            lead={
              <span className={`${styles.rank} type-display-xs`} aria-label={`#${m.rank}`}>
                {m.rank}
              </span>
            }
            sub={
              <>
                {m.champion && <Crown />}
                {m.person.focusing && <FocusingNow label={strings.friends.focusingNow} />}
              </>
            }
          >
            <button type="button" className={styles.score} onClick={() => setOpen(m)}>
              <span className="type-body-md-strong">{formatScore(m.score.score)}</span>
              <span className={`${f.muted} type-caption`}>{formatDuration(m.weekFocusMinutes * 60_000)}</span>
            </button>
            {m.person.userId !== me && (
              <Button variant="secondary" className={f.small} onPointerEnter={() => prefetch(m.person.userId)} onPointerDown={() => prefetch(m.person.userId)} onClick={() => void visit(m.person.userId)}>
                {strings.friends.visit}
              </Button>
            )}
            {m.person.userId !== me && attack?.(m)}
          </PersonRow>
        ))}
      </ul>
      {open && <Breakdown member={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Step 8.5: progress, milestones, days left, contributions. */
function Missions({ group }: { group: GroupView }) {
  const now = useNow(60_000);
  const m = group.mission;
  const max = Math.max(m.targetMinutes * 1.5, m.progressMinutes);
  const days = Math.max(0, Math.ceil((group.week.endsAt - now) / 86_400_000));
  return (
    <div className={styles.stack}>
      <FeatureCard className={f.card}>
        <p className="type-eyebrow">{strings.group.missionEyebrow}</p>
        <p className="type-display-sm">{strings.group.missionProgress(m.progressMinutes, m.targetMinutes)}</p>
        <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={m.targetMinutes} aria-valuenow={Math.floor(m.progressMinutes)}>
          <div className={styles.fill} style={{ width: `${Math.min(100, (m.progressMinutes / max) * 100)}%` }} />
          {m.milestones.map((x) => (
            <span key={x.minutes} className={styles.tick} style={{ left: `${(x.minutes / max) * 100}%` }} />
          ))}
        </div>
        <div className={styles.chips}>
          {m.milestones.map((x, i) => (
            <span key={x.minutes} className={`${styles.chip} type-caption`} data-on={x.reached}>
              {x.reached ? '✓ ' : ''}
              {strings.group.milestone(balance.missions.milestones[i] ?? 0, x.gold)}
            </span>
          ))}
        </div>
        <p className={`${f.muted} type-body-sm`}>{strings.group.daysLeft(days, balance.missions.minContributionMinutes)}</p>
      </FeatureCard>
      {m.contributions.length > 0 && (
        <section>
          <h2 className="type-eyebrow">{strings.group.contributions}</h2>
          <ul className={f.list}>
            {m.contributions.map((c) => (
              <PersonRow key={c.person.userId} person={c.person} compact>
                <span className="type-body-sm-strong">{strings.group.minutes(c.minutes)}</span>
              </PersonRow>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LeaveSheet({ group, me, onClose }: { group: GroupView; me: string | null; onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const leave = useApp((s) => s.leaveGroup);
  const [error, setError] = useState('');
  const owner = group.ownerId === me;
  const alone = group.members.length === 1;
  return (
    <Sheet ref={sheet} title={strings.group.leaveTitle} onClose={onClose}>
      <p className="type-body-md">{owner && !alone ? strings.group.ownerFirst : strings.group.leaveBody}</p>
      {error && <p className={`${sheetStyles.error} type-body-sm`}>{error}</p>}
      <div className={sheetStyles.actions}>
        {(!owner || alone) && (
          <Button
            onClick={async () => {
              const outcome = await leave();
              if (outcome) setError(errorText(outcome));
              else sheet.current?.close();
            }}
          >
            {owner ? strings.group.leaveDisband : strings.group.leave}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

/** Members: roles, presence, visit, owner actions, report, leave (Step 8.2). */
function Members({ group, me }: { group: GroupView; me: string | null }) {
  const removeMember = useApp((s) => s.removeMember);
  const transfer = useApp((s) => s.transferGroup);
  const visit = useApp((s) => s.visitIsland);
  const [menu, setMenu] = useState<MemberView | null>(null);
  const [report, setReport] = useState<MemberView | null>(null);
  const [leaving, setLeaving] = useState(false);
  const owner = group.ownerId === me;
  return (
    <>
      <ul className={f.list}>
        {group.members.map((m) => (
          <PersonRow
            key={m.person.userId}
            person={m.person}
            sub={
              <>
                {m.role === 'owner' && <span className={`${f.muted} type-caption`}>{strings.group.owner}</span>}
                {m.person.focusing && <FocusingNow label={strings.friends.focusingNow} />}
              </>
            }
          >
            {m.person.userId !== me && (
              <>
                <Button variant="secondary" className={f.small} onClick={() => void visit(m.person.userId)}>
                  {strings.friends.visit}
                </Button>
                <IconButton aria-label={strings.friends.more(handleText(m))} onClick={() => setMenu(m)}>
                  <span aria-hidden="true">⋯</span>
                </IconButton>
              </>
            )}
          </PersonRow>
        ))}
      </ul>
      <div className={f.buttons} style={{ marginTop: 'var(--space-xl)' }}>
        <Button variant="secondary" onClick={() => setLeaving(true)}>
          {strings.group.leave}
        </Button>
      </div>
      {menu && (
        <Sheet title={handleText(menu)} onClose={() => setMenu(null)}>
          <div className={sheetStyles.actions}>
            {owner && (
              <>
                <Button variant="secondary" onClick={() => void transfer(menu.person.userId).then(() => setMenu(null))}>
                  {strings.group.makeOwner}
                </Button>
                <Button variant="secondary" onClick={() => void removeMember(menu.person.userId).then(() => setMenu(null))}>
                  {strings.group.remove}
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setReport(menu);
                setMenu(null);
              }}
            >
              {strings.friends.report}
            </Button>
          </div>
        </Sheet>
      )}
      {report && <ReportSheet person={report.person} context="group" onClose={() => setReport(null)} />}
      {leaving && <LeaveSheet group={group} me={me} onClose={() => setLeaving(false)} />}
    </>
  );
}

type Sub = 'ranking' | 'missions' | 'wars' | 'members';

/** The Group tab (Phase 8, DESIGN.md 7.14). */
export function GroupScreen() {
  const status = useApp((s) => s.account.status);
  const me = useApp((s) => s.account.userId);
  const group = useApp((s) => s.group);
  const groupStatus = useApp((s) => s.groupStatus);
  const named = useApp((s) => !!s.social?.me.handle);
  const refresh = useApp((s) => s.refreshGroup);
  const refreshSocial = useApp((s) => s.refreshSocial);
  const [sub, setSub] = useState<Sub>('ranking');
  const [signIn, setSignIn] = useState(false);
  const [attacking, setAttacking] = useState<MemberView | null>(null);

  useEffect(() => {
    if (status !== 'signedIn') return;
    void refresh();
    void refreshSocial();
    const id = setInterval(() => void refresh(), balance.social.presencePollMs);
    return () => clearInterval(id);
  }, [status, refresh, refreshSocial]);

  let body: JSX.Element;
  if (status !== 'signedIn') {
    body = (
      <FeatureCard className={f.card}>
        <p className="type-body-md">{strings.friends.signedOut}</p>
        <div className={f.buttons}>
          <Button onClick={() => setSignIn(true)}>{strings.account.signIn}</Button>
        </div>
      </FeatureCard>
    );
  } else if (groupStatus === 'offline' && !group) {
    body = (
      <FeatureCard className={f.card}>
        <p className="type-body-md">{strings.friends.offline}</p>
        <div className={f.buttons}>
          <Button variant="secondary" onClick={() => void refresh()}>
            {strings.friends.retry}
          </Button>
        </div>
      </FeatureCard>
    );
  } else if (groupStatus !== 'ready' && !group) {
    body = <p className={`${f.muted} type-body-md`}>{strings.friends.loading}</p>;
  } else if (!group) {
    body = named ? <NoGroup /> : <p className="type-body-md">{strings.group.needName}</p>;
  } else {
    const tabs: { value: Sub; label: string }[] = [
      { value: 'ranking', label: strings.group.tabs.ranking },
      { value: 'missions', label: strings.group.tabs.missions },
      ...(features.war ? [{ value: 'wars' as const, label: strings.group.tabs.wars }] : []),
      { value: 'members', label: strings.group.tabs.members },
    ];
    body = (
      <div className={styles.stack}>
        <Header group={group} owner={group.ownerId === me} />
        <Segmented label={strings.group.title} options={tabs} value={sub} onChange={setSub} />
        {sub === 'ranking' && (
          <Ranking
            group={group}
            me={me}
            {...(features.war &&
              group.warEnabled && {
                attack: (m: MemberView) => (
                  <Button variant="secondary" className={f.small} onClick={() => setAttacking(m)}>
                    {strings.war.attack}
                  </Button>
                ),
              })}
          />
        )}
        {attacking && <AttackSheet target={attacking} onClose={() => setAttacking(null)} />}
        {sub === 'missions' && <Missions group={group} />}
        {sub === 'wars' && <WarsTab group={group} />}
        {sub === 'members' && <Members group={group} me={me} />}
      </div>
    );
  }
  return (
    <TabPage title={strings.group.title}>
      {body}
      {signIn && <SignInSheet onClose={() => setSignIn(false)} />}
    </TabPage>
  );
}

export { Ranking };
