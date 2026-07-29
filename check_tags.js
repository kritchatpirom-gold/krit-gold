const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

let openDivs = 0;
let lines = html.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/<div/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    openDivs += opens - closes;
    if (openDivs < 0) {
        console.log(`Extra closing div at line ${i + 1}`);
        openDivs = 0; // reset to avoid cascading
    }
}
console.log(`Total unclosed divs: ${openDivs}`);
