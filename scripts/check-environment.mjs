import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const requiredNodeMajor = 24;
const nodeMajor = Number.parseInt(
  process.versions.node.split('.')[0] ?? '',
  10,
);
const npmVersion = execFileSync('npm', ['--version'], {
  encoding: 'utf8',
}).trim();

console.log(`Node.js: ${process.versions.node}`);
console.log(`npm: ${npmVersion}`);

if (nodeMajor !== requiredNodeMajor) {
  console.error(
    `需要 Node.js ${requiredNodeMajor}.x；当前为 ${process.versions.node}。`,
  );
  process.exitCode = 1;
}

if (process.platform === 'darwin') {
  const chromePath = '/Applications/Google Chrome.app';
  console.log(
    `Google Chrome: ${existsSync(chromePath) ? chromePath : '未安装'}`,
  );

  if (!existsSync(chromePath)) {
    console.error('请安装 Google Chrome 后再进行扩展手动测试。');
    process.exitCode = 1;
  }
}
