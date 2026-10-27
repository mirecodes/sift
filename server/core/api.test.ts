import { describeContract } from './contract.suite';
import { MemoryServerDb } from './db';
import { describeSocial } from './social.suite';

describeContract('memory', () => new MemoryServerDb());
describeSocial('memory', () => new MemoryServerDb());
