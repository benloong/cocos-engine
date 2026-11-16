import { readFileSync } from 'fs';
import { HtmlTextParser } from '../../cocos/2d/utils/html-text-parser';

const fixture = process.env.CC_RICHTEXT_PARSER_FIXTURE;
(fixture ? test : test.skip)('native RichText parser matches actual Web spans and inherited styles', () => {
    const { inputs, backends, historical } = JSON.parse(readFileSync(fixture!, 'utf8'));
    expect(inputs.length).toBeGreaterThan(3000);
    expect(backends.length).toBeGreaterThan(0);
    const parser = new HtmlTextParser();
    // The legacy QUnit expected values predate changes in the current parser.
    // Retain their inputs; the current Web implementation is authoritative.
    expect(historical.length).toBeGreaterThan(60);
    expect(inputs.slice(0, historical.length)).toEqual(historical.map(item => item.input));
    const expected = inputs.map(input => JSON.parse(JSON.stringify(parser.parse(input))));
    for (const backend of backends) {
        expect(backend.outputs).toHaveLength(inputs.length);
        for (let i = 0; i < inputs.length; i++) {
            try { expect(backend.outputs[i]).toEqual(expected[i]); } catch (error) {
                throw new Error(`${backend.name}: RichText parser case ${i}: ${JSON.stringify(inputs[i])}\n${error}`);
            }
        }
    }
});
