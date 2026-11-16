import { SUPPORT_JIT } from 'internal:constants';
import './deserialize.test';

test('deserialization also exercises the JIT implementation', () => {
    expect(SUPPORT_JIT).toBe(true);
});
