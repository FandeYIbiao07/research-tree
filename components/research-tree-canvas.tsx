'use client';
import { NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import {
  X,
  Layers,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  BackgroundBlock,
  Language,
  ResearchProjectState,
} from '@/lib/research-tree/types';
import { moveLayer } from '@/lib/research-tree/workspace';

export function canvasOrder(state: ResearchProjectState) {
  const ids = [
    ...(state.canvas?.backgroundBlocks ?? []).map((b) => b.id),
    ...state.nodes.map((n) => n.id),
    ...state.logicSpots.map((s) => s.id),
  ];
  const existing = (state.canvas?.layerOrder ?? []).filter((id) =>
    ids.includes(id),
  );
  return [...existing, ...ids.filter((id) => !existing.includes(id))];
}
export function BackgroundCard({
  data,
  selected,
}: NodeProps<Node<{ block: BackgroundBlock; language: Language }>>) {
  const { block, language } = data;
  return (
    <div
      className="h-full w-full rounded-xl border-2"
      style={{ borderColor: block.color, backgroundColor: block.color + '18' }}
    >
      <NodeResizer
        isVisible={selected && !block.locked}
        minWidth={160}
        minHeight={160}
        color={block.color}
      />
      <div
        className="block-drag-handle flex h-11 items-center gap-2 rounded-t-lg px-4 font-semibold"
        style={{ backgroundColor: block.color + '28', color: '#1e293b' }}
      >
        {block.locked ? <Lock size={15} /> : <Layers size={15} />}
        <span className="truncate">{block.title[language]}</span>
      </div>
    </div>
  );
}
export function CanvasPanel({
  state,
  language,
  selectedId,
  onSelect,
  onChange,
  onAdd,
  onClose,
}: {
  state: ResearchProjectState;
  language: Language;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (
    updater: (s: ResearchProjectState) => ResearchProjectState,
  ) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const zh = language === 'zh';
  const blocks = state.canvas?.backgroundBlocks ?? [];
  const order = canvasOrder(state);
  const selected = blocks.find((b) => b.id === selectedId);
  const label = (id: string) =>
    blocks.find((b) => b.id === id)?.title[language] ??
    state.nodes.find((n) => n.id === id)?.content[language].title ??
    state.logicSpots.find((s) => s.id === id)?.label[language] ??
    id;
  const patch = (value: Partial<BackgroundBlock>) =>
    onChange((s) => ({
      ...s,
      canvas: {
        backgroundBlocks: (s.canvas?.backgroundBlocks ?? []).map((b) =>
          b.id === selectedId ? { ...b, ...value } : b,
        ),
        layerOrder: canvasOrder(s),
      },
    }));
  const move = (direction: 'front' | 'back' | 'up' | 'down') =>
    selectedId &&
    onChange((s) => ({
      ...s,
      canvas: {
        backgroundBlocks: s.canvas?.backgroundBlocks ?? [],
        layerOrder: moveLayer(canvasOrder(s), selectedId, direction),
      },
    }));
  return (
    <aside
      aria-label={zh ? '背景与图层' : 'Backgrounds and layers'}
      className="absolute right-3 top-3 z-30 flex max-h-[calc(100%-24px)] w-80 flex-col rounded-xl border border-slate-300 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="font-semibold">
          {zh ? '背景与图层' : 'Backgrounds and layers'}
        </h2>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={zh ? '关闭图层面板' : 'Close layers panel'}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="overflow-y-auto p-3 space-y-3">
        <Button variant="outline" className="w-full" onClick={onAdd}>
          <Plus />
          {zh ? '添加背景块' : 'Add background block'}
        </Button>
        <p className="text-sm text-slate-500">
          {zh
            ? '列表从上到下为前景到背景。背景块只用于布局，不改变推理。'
            : 'Front to back. Backgrounds organize the canvas without changing reasoning.'}
        </p>
        <div className="flex gap-1">
          {(['front', 'up', 'down', 'back'] as const).map((d, i) => {
            const Icon = [ChevronsUp, ArrowUp, ArrowDown, ChevronsDown][i];
            const title = (
              zh
                ? ['置于顶层', '上移一层', '下移一层', '置于底层']
                : [
                    'Bring to front',
                    'Bring forward',
                    'Send backward',
                    'Send to back',
                  ]
            )[i];
            return (
              <Button
                key={d}
                size="icon-sm"
                variant="outline"
                disabled={!selectedId}
                title={title}
                aria-label={title}
                onClick={() => move(d)}
              >
                <Icon />
              </Button>
            );
          })}
        </div>
        <fieldset
          className="max-h-48 overflow-y-auto rounded-md border"
          aria-label={zh ? '图层列表' : 'Layer list'}
        >
          {order
            .slice()
            .reverse()
            .map((id) => (
              <button
                key={id}

                aria-pressed={selectedId === id}
                onClick={() => onSelect(id)}
                className={
                  'flex w-full items-center gap-2 truncate border-b px-2 py-2 text-left text-sm ' +
                  (selectedId === id ? 'bg-teal-100' : 'hover:bg-slate-50')
                }
              >
                <span>{blocks.some((b) => b.id === id) ? '▧' : '◇'}</span>
                <span className="truncate">{label(id)}</span>
                {blocks.find((b) => b.id === id)?.locked && <Lock size={12} />}
              </button>
            ))}
        </fieldset>
        {selected && (
          <div className="space-y-3 border-t pt-3">
            {(['en', 'zh'] as const).map((l) => (
              <label key={l} className="block text-sm">
                {l === 'en' ? 'English title' : '中文标题'}
                <Input
                  aria-label={
                    l === 'en' ? 'Background English title' : '背景中文标题'
                  }
                  value={selected.title[l]}
                  onChange={(e) =>
                    patch({ title: { ...selected.title, [l]: e.target.value } })
                  }
                />
              </label>
            ))}
            <div className="flex gap-3">
              <label className="text-sm">
                {zh ? '颜色' : 'Color'}
                <input
                  aria-label={zh ? '背景颜色' : 'Background color'}
                  type="color"
                  className="block h-9 w-12"
                  value={selected.color}
                  onChange={(e) => patch({ color: e.target.value })}
                />
              </label>
              {(['width', 'height'] as const).map((k) => (
                <label key={k} className="text-sm w-24">
                  {k === 'width'
                    ? zh
                      ? '宽度'
                      : 'Width'
                    : zh
                      ? '高度'
                      : 'Height'}
                  <Input
                    type="number"
                    aria-label={k}
                    min={160}
                    max={20000}
                    value={selected[k]}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n) && n >= 160) patch({ [k]: n });
                    }}
                  />
                </label>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => patch({ locked: !selected.locked })}
            >
              {selected.locked ? <Unlock /> : <Lock />}
              {selected.locked
                ? zh
                  ? '解锁背景块'
                  : 'Unlock block'
                : zh
                  ? '锁定背景块'
                  : 'Lock block'}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-red-600"
              onClick={() =>
                onChange((s) => {
                  const positions = { ...s.positions };
                  delete positions[selected.id];
                  return {
                    ...s,
                    positions,
                    canvas: {
                      backgroundBlocks: (
                        s.canvas?.backgroundBlocks ?? []
                      ).filter((b) => b.id !== selected.id),
                      layerOrder: canvasOrder(s).filter(
                        (id) => id !== selected.id,
                      ),
                    },
                  };
                })
              }
            >
              <Trash2 />
              {zh ? '移除背景块' : 'Remove background block'}
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
