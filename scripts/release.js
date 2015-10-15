#! /usr/env babel-node

const {exit} = require('shelljs');
const isOurPackage = require('./utilities/is-our-package');
const {writeFileSync} = require('fs');
const {assign, keys} = Object;
const exec = require('./utilities/exec');

const args = process.argv.slice(2);

const versionBundles = {
  'parametric-svg-spec': [
    'parametric-svg-element',
    'parametric-svg-parse',
    'parametric-svg-patch',
    'parametric-svg-spec',
  ],
};

if (args.length < 2) {
  process.stderr.write('Usage:  release.js <package name> <version keyword>\n');
  exit(1);
}

const [packageName, versionKeyword] = args;
const bundle = versionBundles[packageName] || [packageName];

const packagesRoot = `${__dirname}/../packages`;
const bumpPackage = ({name, version}) => {
  exec(`npm --no-git-tag-version version ${version}`, {
    cwd: `${packagesRoot}/${name}`,
  });
};

console.log('\nBumping package versions…');
bumpPackage({name: packageName, version: versionKeyword});
const versionNumber = (
  require(`${packagesRoot}/${packageName}/package.json`).version
);
bundle
  .filter(name => name !== packageName)
  .forEach(name => bumpPackage({name, version: versionNumber}));
console.log('…done!');

console.log('Updating dependency versions…');
require('./utilities/packages').forEach(({cwd, manifest}) => {
  // We must require `./utilities/packages` after the bumps.

  const {dependencies} = manifest;

  if (dependencies) {
    const newDependencies = keys(dependencies).reduce((target, dep) => assign(
      {}, target,
      {[dep]: (isOurPackage(dep) ?
        versionNumber :
        dependencies[dep]
      )}
    ), {});

    const newManifest = `${
      JSON.stringify(
        assign(manifest, {dependencies: newDependencies}), null, 2
      )
    }\n`;

    writeFileSync(`${cwd}/package.json`, newManifest);
  }
});
console.log('…done!');

console.log('Committing and publishing…');
exec('git add packages/*/package.json');
exec(`git commit --message='${packageName} v${versionNumber}'`);
bundle.forEach(name => {
  exec('npm publish', {cwd: `${packagesRoot}/${name}`});
});
exec('git push');
console.log('…done!');
