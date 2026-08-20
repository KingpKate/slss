#!/usr/bin/env node
/**
 * Repository documentation and clean-replication gate.
 * This intentionally uses only Node built-ins so it can run immediately after
 * checkout, before npm or Maven dependencies are installed.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const requiredFiles = ['README.md', 'DEPLOY.md', 'package.json', 'package-lock.json', 'backend/pom.xml'];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) failures.push(`缺少必需文件: ${file}`);
}

const readme = existsSync(resolve(root, 'README.md')) ? readFileSync(resolve(root, 'README.md'), 'utf8') : '';
const deploy = existsSync(resolve(root, 'DEPLOY.md')) ? readFileSync(resolve(root, 'DEPLOY.md'), 'utf8') : '';
const docs = `${readme}\n${deploy}`;

for (const heading of ['从零获取源码', '初始化 MySQL', 'Tomcat 部署', '校验、构建与生成 WAR', '发布前后验收顺序']) {
  if (!readme.includes(heading)) failures.push(`README 缺少关键章节: ${heading}`);
}
for (const stale of ['slss-v2.git', 'REFACTOR_PLAN.md', 'OPTIMIZATION.md']) {
  if (docs.includes(stale)) failures.push(`文档包含已废弃引用: ${stale}`);
}
if (!docs.includes('github.com/KingpKate/slss')) failures.push('文档未指向当前仓库 KingpKate/slss');
if (!docs.includes('8080')) failures.push('文档未说明受支持的 Tomcat 8080 入口');

// Validate relative Markdown links so deleted docs cannot silently reappear.
const markdownLink = /\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g;
for (const match of readme.matchAll(markdownLink)) {
  const target = match[1];
  if (/^(https?:|mailto:|#)/.test(target)) continue;
  if (!existsSync(resolve(root, target))) failures.push(`README 链接目标不存在: ${target}`);
}

// A clean clone must build the frontend from tracked sources; backend static
// resources are intentionally injected from dist during WAR packaging.
const staticDir = resolve(root, 'backend/src/main/resources/static');
if (existsSync(staticDir) && readdirSync(staticDir).length > 0) {
  failures.push('backend/src/main/resources/static 必须为空，避免旧前端资源进入 WAR');
}
if (!existsSync(resolve(root, 'backend/src/main/resources/db/migration'))) {
  failures.push('缺少 Flyway 迁移目录');
}

if (failures.length) {
  console.error('Documentation/replication gate failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Documentation/replication gate passed: required docs, links, repository references, and clean-build prerequisites are valid.');
