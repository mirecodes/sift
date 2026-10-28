import { describeContract } from './contract.suite';
import { MemoryServerDb } from './db';
import { describeGroups } from './groups.suite';
import { describeSocial } from './social.suite';

describeContract('memory', () => new MemoryServerDb());
describeSocial('memory', () => new MemoryServerDb());
describeGroups('memory', () => new MemoryServerDb());
