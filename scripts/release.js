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

// Check for dirty worktree (uncommitted changes)
try {
  const status = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf8' });
  if (status.trim()) {
    console.error('❌ Error: Working tree is dirty. Please commit or stash changes before releasing.');
    console.error('\nUncommitted changes:');
    console.error(status);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error: Failed to check git status');
  console.error(error.message);
  process.exit(1);
}

try {
  // 1. Update package.json
  console.log(`\n📦 Updating package.json to version ${newVersion}...`);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const oldVersion = packageJson.version;
  
  // Check if version is already set
  if (packageJson.version === newVersion) {
    console.log(`⚠️  Version ${newVersion} already set in package.json`);
  } else {
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  // 2. Git Commit
  console.log('💾 Committing change...');
  execSync('git add package.json package-lock.json', { cwd: rootDir, stdio: 'inherit' });
  execSync(`git commit -m "chore: release ${newVersion}"`, { cwd: rootDir, stdio: 'inherit' });

  // 3. Git Tag (only if tag doesn't exist)
  const tags = execSync('git tag -l', { cwd: rootDir, encoding: 'utf8' });
  if (tags.split('\n').includes(newVersion)) {
    console.log(`⚠️  Tag ${newVersion} already exists`);
  } else {
    console.log(`🏷️  Creating tag ${newVersion}...`);
    execSync(`git tag ${newVersion}`, { cwd: rootDir, stdio: 'inherit' });
  }

  // 4. Git Push
  console.log('🚀 Pushing to remote...');
  try {
    execSync('git push', { cwd: rootDir, stdio: 'inherit' });
  } catch (error) {
    // Branch might already be up to date
    console.log('⚠️  Branch already up to date on remote');
  }
  
  // Push tag if it doesn't exist on remote
  try {
    execSync(`git push origin ${newVersion}`, { cwd: rootDir, stdio: 'inherit' });
  } catch (error) {
    // Tag might already exist on remote
    console.log(`⚠️  Tag ${newVersion} already exists on remote`);
  }

  console.log(`\n✅ Successfully released ${newVersion}`);
  console.log(`   Previous: ${oldVersion}`);
  console.log(`   Current:  ${newVersion}`);

} catch (error) {
  console.error('\n❌ Release failed:', error.message);
  process.exit(1);
}
