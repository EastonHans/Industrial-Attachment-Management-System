
const { exec } = require('child_process');

// Run the TypeScript seed file using ts-node
exec('npx ts-node -r tsconfig-paths/register src/scripts/seedDatabase.ts', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
    return;
  }
  console.log(`Output: ${stdout}`);
});
