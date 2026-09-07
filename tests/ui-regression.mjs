import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.RESEARCH_TREE_URL || 'http://localhost:5173', {
    waitUntil: 'networkidle',
  });
  await page.getByText('Workspace saved locally', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Backgrounds & layers', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Add background block', exact: true })
    .click();
  await page
    .getByLabel('Background English title', { exact: true })
    .fill('Regional research');
  await page.getByLabel('背景中文标题', { exact: true }).fill('区域研究');
  await page.getByLabel('width', { exact: true }).fill('780');
  await page.getByLabel('height', { exact: true }).fill('520');
  await page.getByLabel('Background color', { exact: true }).fill('#339988');
  await page.getByRole('button', { name: 'Lock block', exact: true }).click();
  await page
    .getByRole('button', { name: 'Bring to front', exact: true })
    .click();
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('research-tree.workspace.v3')),
  );
  const doc = saved.documents[0];
  const block = doc.tree.canvas.backgroundBlocks[0];
  assert.equal(block.title.en, 'Regional research');
  assert.equal(block.width, 780);
  assert.equal(block.color, '#339988');
  assert.equal(block.locked, true);
  assert.equal(doc.tree.canvas.layerOrder.at(-1), block.id);
  await page.reload({ waitUntil: 'networkidle' });
  await page
    .getByRole('button', { name: 'Backgrounds & layers', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Regional research', exact: false })
    .click();
  await page.getByRole('button', { name: 'Unlock block', exact: true }).click();
  await page.getByRole('button', { name: 'Send to back', exact: true }).click();
  await page
    .getByRole('button', { name: 'Close layers panel', exact: true })
    .click();
  // Exercise real pointer dragging and corner resizing.
  const graphBlock = page.locator(`.react-flow__node[data-id="${block.id}"]`);
  const handle = graphBlock.locator('.block-drag-handle');
  const rect = await handle.boundingBox();
  await page.mouse.move(rect.x + 100, rect.y + 20);
  await page.mouse.down();
  await page.mouse.move(rect.x + 160, rect.y + 55, { steps: 8 });
  await page.mouse.up();
  if (
    await page
      .getByRole('button', { name: 'Close layers panel', exact: true })
      .count()
  )
    await page
      .getByRole('button', { name: 'Close layers panel', exact: true })
      .click();
  await page.waitForFunction((id) => {
    const w = JSON.parse(localStorage.getItem('research-tree.workspace.v3'));
    return w.documents[0].tree.positions[id].x > 80;
  }, block.id);
  // Bring the selected background above overlapping cards before using its corner.
  await page
    .getByRole('button', { name: 'Backgrounds & layers', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Bring to front', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Close layers panel', exact: true })
    .click();
  const corner = graphBlock.locator(
    '.react-flow__resize-control.bottom.right.handle',
  );
  const cornerRect = await corner.boundingBox();
  assert.ok(cornerRect);
  await page.mouse.move(cornerRect.x + 2, cornerRect.y + 2);
  await page.mouse.down();
  await page.mouse.move(cornerRect.x + 70, cornerRect.y + 45, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction((id) => {
    const w = JSON.parse(localStorage.getItem('research-tree.workspace.v3'));
    return (
      w.documents[0].tree.canvas.backgroundBlocks.find((b) => b.id === id)
        .width > 800
    );
  }, block.id);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save file', exact: true }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
  assert.equal(exported.tree.canvas.backgroundBlocks.length, 1);
  assert.ok(exported.tree.canvas.backgroundBlocks[0].width > 800);
  await page.screenshot({ path: 'work/ui-canvas.png' });
  // Close the last tab, reload, and restore it.
  await page.getByRole('button', { name: /Close tab:/ }).click();
  await page.getByText('No open trees', { exact: true }).waitFor();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('No open trees', { exact: true }).waitFor();
  await page.getByRole('button', { name: /Reopen \(1\)/ }).click();
  await page
    .getByRole('button', { name: 'Weekend Library Access', exact: true })
    .click();
  await page
    .getByRole('tab', { name: 'Weekend Library Access', exact: true })
    .waitFor();
  // A rejected file must not alter any workspace documents.
  await page.waitForFunction(() => {
    const w = JSON.parse(
      localStorage.getItem('research-tree.workspace.v3') || '{}',
    );
    return (
      w.documents?.length === 1 &&
      w.activeDocumentId === w.documents[0].documentId
    );
  });
  const before = await page.evaluate(() =>
    localStorage.getItem('research-tree.workspace.v3'),
  );
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"fileType":"wrong"}'),
  });
  await page.getByRole('alert').filter({ hasText: 'fileType' }).waitFor();
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem('research-tree.workspace.v3'),
    ),
    before,
  );
  if (process.env.RESEARCH_TREE_FIXTURE) {
    await page
      .locator('input[type=file]')
      .setInputFiles(process.env.RESEARCH_TREE_FIXTURE);
    await page.waitForFunction(() => {
      const w = JSON.parse(
        localStorage.getItem('research-tree.workspace.v3') || '{}',
      );
      return w.documents?.some(
        (d) =>
          d.documentId === w.activeDocumentId && d.tree.nodes.length === 94,
      );
    });
    const current = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('research-tree.workspace.v3')),
    );
    const imported = current.documents.find(
      (d) => d.documentId === current.activeDocumentId,
    );
    assert.equal(imported.tree.nodes.length, 94);
    assert.equal(imported.tree.edges.length, 115);
    assert.ok(imported.tree.decisionLog.length >= 98);
    assert.equal(current.documents.length, 2);
    await page.screenshot({ path: 'work/ui-imported.png' });
  }
  // Corrupt storage remains byte-for-byte intact and exposes a recovery error.
  const raw = '{"schemaVersion":1,"documents":[{"broken":true}]}';
  const recoveryPage = await browser.newPage();
  await recoveryPage.addInitScript(
    (raw) => localStorage.setItem('research-tree.workspace.v3', raw),
    raw,
  );
  await recoveryPage.goto(
    process.env.RESEARCH_TREE_URL || 'http://localhost:5173',
    { waitUntil: 'networkidle' },
  );
  await recoveryPage
    .getByRole('alert')
    .filter({ hasText: 'fileType' })
    .waitFor();
  assert.equal(
    await recoveryPage.evaluate(() =>
      localStorage.getItem('research-tree.workspace.v3'),
    ),
    raw,
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS browser: background title/size/lock/layers, reload, close-last/reopen, atomic invalid import, actual research import; no page errors',
  );
} finally {
  await browser.close();
}
