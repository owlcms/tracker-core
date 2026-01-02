#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');

const args = process.argv.slice(2);
const newVersion = args[0];

if (!newVersion) {
  console.error('❌ Error: Please provide a version number.');
  console.error('Usage: npm run release <version>');
  console.error('Example: npm run release 1.0.0-beta01');
  process.exit(1);
}

// Validate version format (simple check)
if (!/^\d+\.\d+\.\d+/.test(newVersion)) {
  console.error(`❌ Error: Version "${newVersion}" does not look like a valid semver version.`);
  process.exit(1);
}

try {
  // 1. Update package.json
  console.log(`\n📦 Updating package.json to version ${newVersion}...`);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  // 2. Git Commit
  console.log('💾 Committing change...');
  execSync('git add package.json', { cwd: rootDir, stdio: 'inherit' });
  execSync(`git commit -m "chore: release ${newVersion}"`, { cwd: rootDir, stdio: 'inherit' });

  // 3. Git Tag
  console.log(`🏷️  Creating tag ${newVersion}...`);
  execSync(`git tag ${newVersion}`, { cwd: rootDir, stdio: 'inherit' });

  // 4. Git Push
  console.log('🚀 Pushing to remote...');
  execSync('git push', { cwd: rootDir, stdio: 'inherit' });
  execSync(`git push origin ${newVersion}`, { cwd: rootDir, stdio: 'inherit' });

  console.log(`\n✅ Successfully released ${newVersion}`);
  console.log(`   Previous: ${oldVersion}`);
  console.log(`   Current:  ${newVersion}`);

} catch (error) {
  console.error('\n❌ Release failed:', error.message);
  process.exit(1);
}
