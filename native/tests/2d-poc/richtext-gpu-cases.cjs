'use strict';

const wordWrapNames = [
    'label-word-wrap-clamp', 'label-word-wrap-shrink', 'label-word-wrap-resize-height',
    'label-paragraph-bidi', 'label-paragraph-thai', 'label-paragraph-combining', 'label-paragraph-whitespace',
];
const richTextNames = [
    'text-basic', 'text-bold', 'text-italic', 'text-underline', 'text-outline', 'text-nested', 'text-colors',
    'text-wrap-left', 'text-wrap-center', 'text-wrap-right', 'text-multiline', 'text-unicode', 'text-shadow-tag',
    'text-bidi-override', 'text-bidi-visual', 'text-thai-marks',
];
const shadowNames = [];
for (const overflow of [0, 1, 2, 3]) {
    for (const align of [0, 1, 2]) {
        for (const sign of ['positive', 'negative']) {
            shadowNames.push(`label-shadow-${overflow}-${align}-${sign}`);
        }
    }
}
shadowNames.push('label-shadow-multiline-positive', 'label-shadow-multiline-negative');
shadowNames.push('label-shadow-blur-2', 'label-shadow-blur-4', 'label-shadow-blur-8',
    'label-shadow-blur-clipped-positive', 'label-shadow-blur-clipped-negative');
const lifecycleNames = ['richtext-lifecycle-grid', 'richtext-lifecycle-disabled', 'richtext-lifecycle-rebuilt', 'richtext-lifecycle-destroyed'];
const aliasNames = ['font-alias-both-0', 'font-alias-only-1', 'font-alias-both-1', 'font-alias-only-0'];
module.exports = { wordWrapNames, richTextNames, shadowNames, lifecycleNames, aliasNames,
    captures: wordWrapNames.concat(richTextNames, shadowNames, lifecycleNames, aliasNames) };
