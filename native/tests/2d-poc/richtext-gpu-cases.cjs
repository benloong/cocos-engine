'use strict';

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
module.exports = { richTextNames, shadowNames, captures: richTextNames.concat(shadowNames) };
