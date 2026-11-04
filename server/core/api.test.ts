import { describeContract } from './contract.suite';
import { MemoryServerDb } from './db';
import { describeGroups } from './groups.suite';
import { describeSocial } from './social.suite';
import { describeWar } from './war.suite';

describeContract('memory', () => new MemoryServerDb());
describeSocial('memory', () => new MemoryServerDb());
describeGroups('memory', () => new MemoryServerDb());
describeWar('memory', () => new MemoryServerDb());
