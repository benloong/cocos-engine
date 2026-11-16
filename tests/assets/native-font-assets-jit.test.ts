import { SUPPORT_JIT } from 'internal:constants';
import './native-font-assets.test';

test('font deserialization also exercises the JIT implementation', () => {
    expect(SUPPORT_JIT).toBe(true);
});
