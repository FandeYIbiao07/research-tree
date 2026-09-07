'use client';

import '@xyflow/react/dist/style.css';
import {
  BackgroundCard,
  CanvasPanel,
  canvasOrder,
} from './research-tree-canvas';
import {
  closeDocument,
  reopenDocument,
  upsertDocument,
} from '@/lib/research-tree/workspace';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeProps,
  type NodeTypes,
  type Viewport,
  type ReactFlowInstance,
} from '@xyflow/react';
import {
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileJson2,
  FileSearch,
  Filter,
  FlaskConical,
  FolderPlus,
  GitBranch,
  Languages,
  Layers,
  Lightbulb,
  Link2,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Scale,
  Search,
  ShieldQuestion,
  Sigma,
  Trash2,
  Upload,
  Workflow,
  X,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  copy,
  logicSpotLabels,
  logicSpotRules,
  nodeTypeLabels,
  relationshipLabels,
  statusLabels,
  type Language,
} from '@/lib/research-tree/i18n';
import {
  createBlankResearchTreeDocument,
  parseResearchTreeDocument,
  researchTreeRepository,
  serializeNode,
  serializeResearchTreeDocument,
} from '@/lib/research-tree/repository';
import {
  emptyContent,
  LOGIC_SPOT_TYPES,
  NODE_STATUSES,
  NODE_TYPES,
  RELATIONSHIP_TYPES,
  nodeText,
  type LocalizedNodeContent,
  type LocalizedText,
  type LogicSpot,
  type LogicSpotType,
  type NodeStatus,
  type NodeType,
  type RelationshipType,
  type ResearchEdge,
  type ResearchNode,
  type ResearchProjectState,
  type ResearchTreeDocument,
  type ResearchTreeWorkspace,
} from '@/lib/research-tree/types';
import { cn } from '@/lib/utils';

const STATUS_STYLE: Record<
  NodeStatus,
  {
    color: string;
    soft: string;
    label: 'passed' | 'inProgress' | 'unresolved' | 'failed';
  }
> = {
  confirmed: { color: '#15803d', soft: '#ecfdf3', label: 'passed' },
  tentative: { color: '#2563eb', soft: '#eff6ff', label: 'inProgress' },
  needsVerification: { color: '#ca8a04', soft: '#fffbeb', label: 'unresolved' },
  rejected: { color: '#dc2626', soft: '#fef2f2', label: 'failed' },
  supersededReopened: {
    color: '#64748b',
    soft: '#f1f5f9',
    label: 'unresolved',
  },
};

const NODE_SHAPE: Record<NodeType, string> = {
  evidence: 'rounded-[5px] border-l-[5px]',
  idea: 'rounded-[22px] border border-dashed',
  hypothesis: 'rounded-xl border-2 border-dashed',
  assumption: 'rounded-xl border-t-[5px]',
  judgement:
    'rounded-none border-l-[5px] outline outline-1 outline-offset-2 outline-slate-200',
  decision: 'rounded-xl border-2 shadow-[4px_4px_0_#dce3e8]',
  openQuestion: 'rounded-[26px] border-2',
  rejectedBranch:
    'rounded-md border border-dashed bg-[repeating-linear-gradient(135deg,#fff,#fff_8px,#f8fafc_8px,#f8fafc_16px)]',
};

const EDGE_STYLE: Record<RelationshipType, { color: string; dash?: string }> = {
  supports: { color: '#0f766e' },
  contradicts: { color: '#dc2626', dash: '7 5' },
  modifies: { color: '#c97812', dash: '3 4' },
  replaces: { color: '#7c3aed' },
  dependsOn: { color: '#64748b', dash: '2 4' },
};

const typeIcons: Record<NodeType, typeof BookOpen> = {
  evidence: BookOpen,
  idea: Lightbulb,
  hypothesis: FlaskConical,
  assumption: ShieldQuestion,
  judgement: Scale,
  decision: CheckCircle2,
  openQuestion: CircleHelp,
  rejectedBranch: GitBranch,
};

const logicSymbols: Record<LogicSpotType, string> = {
  any: '∨',
  all: '∧',
  exactlyOne: '⊕',
  none: '↓',
  not: '¬',
  atLeastK: 'Σ',
};

const localized = (en: string, zh: string): LocalizedText => ({ en, zh });

function evaluateLogic(spot: LogicSpot, nodes: ResearchNode[]): NodeStatus {
  const statuses = spot.inputNodeIds.map(
    (id) => nodes.find((node) => node.id === id)?.status ?? 'needsVerification',
  );
  const passed = statuses.filter((status) => status === 'confirmed').length;
  const failed = statuses.filter((status) => status === 'rejected').length;
  const ongoing = statuses.some((status) => status === 'tentative');
  const unresolved = statuses.length - passed - failed;
  const pending = (): NodeStatus =>
    ongoing ? 'tentative' : 'needsVerification';
  if (!statuses.length) return 'needsVerification';
  if (spot.logicType === 'any')
    return passed > 0
      ? 'confirmed'
      : failed === statuses.length
        ? 'rejected'
        : pending();
  if (spot.logicType === 'all')
    return failed > 0
      ? 'rejected'
      : passed === statuses.length
        ? 'confirmed'
        : pending();
  if (spot.logicType === 'none')
    return passed > 0
      ? 'rejected'
      : failed === statuses.length
        ? 'confirmed'
        : pending();
  if (spot.logicType === 'not')
    return statuses[0] === 'rejected'
      ? 'confirmed'
      : statuses[0] === 'confirmed'
        ? 'rejected'
        : pending();
  if (spot.logicType === 'exactlyOne') {
    if (passed > 1) return 'rejected';
    if (passed === 1 && failed === statuses.length - 1) return 'confirmed';
    if (!unresolved && passed !== 1) return 'rejected';
    return pending();
  }
  const threshold = Math.max(1, Math.min(spot.threshold ?? 1, statuses.length));
  if (passed >= threshold) return 'confirmed';
  if (passed + unresolved < threshold) return 'rejected';
  return pending();
}

function applyLogicStatuses(state: ResearchProjectState): ResearchProjectState {
  let nodes = state.nodes;
  for (let pass = 0; pass <= state.logicSpots.length; pass += 1) {
    nodes = nodes.map((node) => {
      const spot = state.logicSpots.find(
        (item) => item.parentNodeId === node.id,
      );
      return spot ? { ...node, status: evaluateLogic(spot, nodes) } : node;
    });
  }
  const changed = nodes.filter(
    (node, i) => node.status !== state.nodes[i].status,
  );
  if (!changed.length) return { ...state, nodes };
  const now = new Date().toISOString();
  return {
    ...state,
    nodes,
    decisionLog: [
      ...state.decisionLog,
      ...changed.map((node) => ({
        id: crypto.randomUUID(),
        nodeId: node.id,
        action: 'statusChanged' as const,
        summary: localized(
          `Logic recalculated: ${state.nodes.find((n) => n.id === node.id)?.status} → ${node.status}`,
          `逻辑重算：${state.nodes.find((n) => n.id === node.id)?.status} → ${node.status}`,
        ),
        timestamp: now,
      })),
    ],
  };
}

type ResearchCardData = {
  node: ResearchNode;
  language: Language;
  collapsed: boolean;
  hasChildren: boolean;
  traced: boolean;
  traceActive: boolean;
  onToggleCollapse: (id: string) => void;
};

function ResearchCard({
  data,
  selected,
}: NodeProps<FlowNode<ResearchCardData>>) {
  const {
    node,
    language,
    collapsed,
    hasChildren,
    traced,
    traceActive,
    onToggleCollapse,
  } = data;
  const text = nodeText(node, language);
  const status = STATUS_STYLE[node.status];
  const Icon = typeIcons[node.type];
  return (
    <article
      className={cn(
        'group w-[258px] bg-white shadow-[0_9px_28px_rgba(23,31,42,.08)] transition duration-200',
        NODE_SHAPE[node.type],
        selected && 'ring-2 ring-slate-500/25',
        !selected &&
          'hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(23,31,42,.13)]',
        traceActive && !traced && 'opacity-20 grayscale',
        node.status === 'supersededReopened' && 'opacity-75',
      )}
      style={{ borderColor: status.color }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-white !bg-slate-500"
      />
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.11em] text-slate-600">
              {nodeTypeLabels[language][node.type]}
            </span>
            {hasChildren && (
              <button
                type="button"
                className="nodrag grid size-6 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCollapse(node.id);
                }}
                aria-label={
                  collapsed
                    ? copy[language].expandBranch
                    : copy[language].collapseBranch
                }
              >
                {collapsed ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>
            )}
          </div>
          <h3
            className={cn(
              'line-clamp-2 text-sm font-bold leading-5 text-slate-950',
              node.status === 'supersededReopened' &&
                'line-through decoration-slate-400',
            )}
          >
            {text.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-xs leading-[1.15rem] text-slate-500">
            {text.summary}
          </p>
          <span
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold"
            style={{
              color: status.color,
              background: status.soft,
              borderColor: `${status.color}44`,
            }}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: status.color }}
            />
            {statusLabels[language][node.status]}
          </span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-white !bg-slate-500"
      />
    </article>
  );
}

type LogicCardData = {
  spot: LogicSpot;
  language: Language;
  status: NodeStatus;
  passing: number;
  total: number;
  traced: boolean;
  traceActive: boolean;
};

function LogicCard({ data, selected }: NodeProps<FlowNode<LogicCardData>>) {
  const { spot, language, status, passing, total, traced, traceActive } = data;
  const palette = STATUS_STYLE[status];
  const threshold =
    spot.logicType === 'atLeastK'
      ? `${spot.threshold ?? 1}/${total}`
      : `${passing}/${total}`;
  return (
    <article
      className={cn(
        'grid size-[116px] place-items-center rounded-full border-[5px] bg-white text-center shadow-[0_9px_26px_rgba(23,31,42,.12)] transition',
        selected && 'ring-4 ring-slate-400/25',
        traceActive && !traced && 'opacity-20 grayscale',
      )}
      style={{ borderColor: palette.color }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-white !bg-slate-600"
      />
      <div>
        <span
          className="block font-serif text-3xl font-bold leading-none"
          style={{ color: palette.color }}
        >
          {logicSymbols[spot.logicType]}
        </span>
        <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-700">
          {logicSpotLabels[language][spot.logicType]}
        </span>
        <span
          className="mt-1 block text-[10px] font-bold"
          style={{ color: palette.color }}
        >
          {threshold} · {copy[language][palette.label]}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-white !bg-slate-600"
      />
    </article>
  );
}

const flowNodeTypes: NodeTypes = {
  research: ResearchCard,
  logic: LogicCard,
  background: BackgroundCard,
};
type NodeDraft = Pick<ResearchNode, 'type' | 'status' | 'content'>;
const blankDraft = (): NodeDraft => ({
  type: 'idea',
  status: 'tentative',
  content: { en: emptyContent(), zh: emptyContent() },
});

function AppSelect<T extends string>({
  value,
  onValueChange,
  options,
  labels,
  placeholder,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly T[];
  labels: Record<T, string>;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as T)}>
      <SelectTrigger className={cn('w-full bg-white', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {labels[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NodeEditor({
  open,
  onOpenChange,
  language,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  initial: NodeDraft;
  onSave: (draft: NodeDraft) => void;
}) {
  const t = copy[language];
  const [draft, setDraft] = useState<NodeDraft>(initial);
  const [contentLanguage, setContentLanguage] = useState<Language>(language);
  const [error, setError] = useState('');
  const active = draft.content[contentLanguage];
  const setActive = (patch: Partial<LocalizedNodeContent>) =>
    setDraft((current) => ({
      ...current,
      content: {
        ...current.content,
        [contentLanguage]: { ...current.content[contentLanguage], ...patch },
      },
    }));
  const submit = () => {
    if (!active.title.trim()) {
      setError(t.titleRequired);
      return;
    }
    const otherLanguage: Language = contentLanguage === 'en' ? 'zh' : 'en';
    const fallback = {
      ...draft.content[contentLanguage],
      assumptions: [...draft.content[contentLanguage].assumptions],
    };
    const other = draft.content[otherLanguage].title.trim()
      ? draft.content[otherLanguage]
      : fallback;
    onSave({
      ...draft,
      content: {
        ...draft.content,
        [contentLanguage]: { ...active, title: active.title.trim() },
        [otherLanguage]: other,
      },
    });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>
            {initial.content.en.title || initial.content.zh.title
              ? t.editNode
              : t.createNode}
          </DialogTitle>
          <DialogDescription>{t.notesHint}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-2">
          <span className="text-xs font-bold text-slate-600">
            {t.contentLanguage}
          </span>
          <div className="flex rounded-md border bg-white p-0.5">
            <Button
              size="sm"
              variant={contentLanguage === 'en' ? 'secondary' : 'ghost'}
              className="h-7"
              onClick={() => {
                setContentLanguage('en');
                setError('');
              }}
            >
              English
            </Button>
            <Button
              size="sm"
              variant={contentLanguage === 'zh' ? 'secondary' : 'ghost'}
              className="h-7"
              onClick={() => {
                setContentLanguage('zh');
                setError('');
              }}
            >
              中文
            </Button>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="node-title">{t.title}</Label>
            <Input
              id="node-title"
              value={active.title}
              onChange={(event) => setActive({ title: event.target.value })}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>{t.nodeType}</Label>
              <AppSelect
                value={draft.type}
                onValueChange={(type) => setDraft({ ...draft, type })}
                options={NODE_TYPES}
                labels={nodeTypeLabels[language]}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t.status}</Label>
              <AppSelect
                value={draft.status}
                onValueChange={(status) => setDraft({ ...draft, status })}
                options={NODE_STATUSES}
                labels={statusLabels[language]}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="node-summary">{t.summary}</Label>
            <Textarea
              id="node-summary"
              rows={3}
              value={active.summary}
              onChange={(event) => setActive({ summary: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="node-source">{t.source}</Label>
            <Input
              id="node-source"
              placeholder={t.sourceHint}
              value={active.source}
              onChange={(event) => setActive({ source: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="node-assumptions">{t.assumptions}</Label>
            <Textarea
              id="node-assumptions"
              rows={3}
              placeholder={t.assumptionsHint}
              value={active.assumptions.join('\n')}
              onChange={(event) =>
                setActive({
                  assumptions: event.target.value
                    .split('\n')
                    .map((line) => line.trim()),
                })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="node-notes">{t.notes}</Label>
            <Textarea
              id="node-notes"
              rows={4}
              placeholder={t.notesHint}
              value={active.notes}
              onChange={(event) => setActive({ notes: event.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={submit}>{t.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectEditor({
  open,
  onOpenChange,
  language,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  onSave: (title: LocalizedText, question: LocalizedText) => void;
}) {
  const t = copy[language];
  const [titleEn, setTitleEn] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [questionEn, setQuestionEn] = useState('');
  const [questionZh, setQuestionZh] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (!titleEn.trim() || !titleZh.trim()) {
      setError(t.requiredBothTitles);
      return;
    }
    onSave(
      localized(titleEn.trim(), titleZh.trim()),
      localized(questionEn.trim(), questionZh.trim()),
    );
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{t.createTree}</DialogTitle>
          <DialogDescription>{t.portableFileHint}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="tree-title-en">{t.titleEn}</Label>
              <Input
                id="tree-title-en"
                value={titleEn}
                onChange={(event) => setTitleEn(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tree-title-zh">{t.titleZh}</Label>
              <Input
                id="tree-title-zh"
                value={titleZh}
                onChange={(event) => setTitleZh(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="tree-question-en">{t.questionEn}</Label>
              <Textarea
                id="tree-question-en"
                rows={3}
                value={questionEn}
                onChange={(event) => setQuestionEn(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tree-question-zh">{t.questionZh}</Label>
              <Textarea
                id="tree-question-zh"
                rows={3}
                value={questionZh}
                onChange={(event) => setQuestionZh(event.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={submit}>{t.createTree}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RelationshipEditor({
  open,
  onOpenChange,
  language,
  nodes,
  initialSource,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  nodes: ResearchNode[];
  initialSource: string;
  onSave: (
    source: string,
    target: string,
    relationship: RelationshipType,
    note: string,
  ) => void;
}) {
  const t = copy[language];
  const [source, setSource] = useState(initialSource || nodes[0]?.id || '');
  const [target, setTarget] = useState(
    nodes.find((node) => node.id !== initialSource)?.id || '',
  );
  const [relationship, setRelationship] =
    useState<RelationshipType>('supports');
  const [note, setNote] = useState('');
  const labels = Object.fromEntries(
    nodes.map((node) => [node.id, nodeText(node, language).title]),
  ) as Record<string, string>;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t.createRelationship}</DialogTitle>
          <DialogDescription>
            {language === 'en'
              ? 'Use these links for reasoning effects. Use a logic spot for formal question decomposition.'
              : '这些连线用于表达论证影响；形式化的问题拆分请使用逻辑 spot。'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>{t.from}</Label>
            <AppSelect
              value={source}
              onValueChange={setSource}
              options={nodes.map((node) => node.id)}
              labels={labels}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t.relationship}</Label>
            <AppSelect
              value={relationship}
              onValueChange={setRelationship}
              options={RELATIONSHIP_TYPES}
              labels={relationshipLabels[language]}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t.to}</Label>
            <AppSelect
              value={target}
              onValueChange={setTarget}
              options={nodes
                .filter((node) => node.id !== source)
                .map((node) => node.id)}
              labels={labels}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edge-note">{t.relationshipNote}</Label>
            <Textarea
              id="edge-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button
            disabled={!source || !target || source === target}
            onClick={() => {
              onSave(source, target, relationship, note.trim());
              onOpenChange(false);
            }}
          >
            {t.connect}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogicSpotEditor({
  open,
  onOpenChange,
  language,
  nodes,
  existingParentIds,
  initialParent,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  nodes: ResearchNode[];
  existingParentIds: string[];
  initialParent: string;
  onSave: (
    parentId: string,
    inputIds: string[],
    logicType: LogicSpotType,
    threshold: number,
  ) => void;
}) {
  const t = copy[language];
  const parents = nodes.filter((node) => !existingParentIds.includes(node.id));
  const [parentId, setParentId] = useState(
    parents.some((node) => node.id === initialParent)
      ? initialParent
      : (parents[0]?.id ?? ''),
  );
  const [inputIds, setInputIds] = useState<string[]>([]);
  const [logicType, setLogicType] = useState<LogicSpotType>('any');
  const [threshold, setThreshold] = useState(1);
  const [error, setError] = useState('');
  const labels = Object.fromEntries(
    nodes.map((node) => [node.id, nodeText(node, language).title]),
  ) as Record<string, string>;
  const toggleInput = (id: string, checked: boolean) =>
    setInputIds((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id),
    );
  const submit = () => {
    if (!inputIds.length) {
      setError(t.selectInputs);
      return;
    }
    if (logicType === 'not' && inputIds.length !== 1) {
      setError(t.selectOneInput);
      return;
    }
    onSave(parentId, inputIds, logicType, threshold);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{t.createLogicSpot}</DialogTitle>
          <DialogDescription>{t.logicExplain}</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-4">
          <div className="grid gap-2">
            <Label>{t.parentQuestion}</Label>
            <AppSelect
              value={parentId}
              onValueChange={(id) => {
                setParentId(id);
                setInputIds((current) => current.filter((item) => item !== id));
              }}
              options={parents.map((node) => node.id)}
              labels={labels}
            />
          </div>
          <div className="grid grid-cols-[1fr_150px] gap-3">
            <div className="grid gap-2">
              <Label>{t.logicRule}</Label>
              <AppSelect
                value={logicType}
                onValueChange={setLogicType}
                options={LOGIC_SPOT_TYPES}
                labels={logicSpotLabels[language]}
              />
            </div>
            {logicType === 'atLeastK' && (
              <div className="grid gap-2">
                <Label htmlFor="logic-k">{t.threshold}</Label>
                <Input
                  id="logic-k"
                  type="number"
                  min={1}
                  max={Math.max(1, inputIds.length)}
                  value={threshold}
                  onChange={(event) => setThreshold(Number(event.target.value))}
                />
              </div>
            )}
          </div>
          <div className="grid min-h-0 gap-2">
            <Label>{t.independentInputs}</Label>
            <ScrollArea className="max-h-[260px] rounded-lg border">
              <div className="grid gap-1 p-2">
                {nodes
                  .filter((node) => node.id !== parentId)
                  .map((node) => (
                    <label
                      key={node.id}
                      className="flex cursor-pointer items-start gap-3 rounded-md p-2.5 hover:bg-slate-50"
                    >
                      <Checkbox
                        checked={inputIds.includes(node.id)}
                        onCheckedChange={(checked) =>
                          toggleInput(node.id, Boolean(checked))
                        }
                      />
                      <span className="text-sm leading-5 text-slate-700">
                        {nodeText(node, language).title}
                        <span className="block text-xs text-slate-400">
                          {nodeTypeLabels[language][node.type]}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
            </ScrollArea>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={submit}>{t.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function ResearchTreeApp() {
  const [hydrated, setHydrated] = useState(false);
  const [workspace, setWorkspace] = useState<ResearchTreeWorkspace>(() => {
    const loaded = researchTreeRepository.loadWorkspace();
    return {
      ...loaded,
      documents: loaded.documents.map((document) => ({
        ...document,
        tree: applyLogicStatuses(document.tree),
      })),
    };
  });
  const [emptyDocument] = useState(() =>
    createBlankResearchTreeDocument(
      localized('No open tree', '没有打开的研究树'),
      localized('', ''),
      'zh',
    ),
  );
  const hasDocument = workspace.documents.length > 0;
  const [layersOpen, setLayersOpen] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const [canvasImportRevision, setCanvasImportRevision] = useState(0);
  const [storageError, setStorageError] = useState('');
  const [savedWorkspace, setSavedWorkspace] =
    useState<ResearchTreeWorkspace | null>(null);
  const saving = savedWorkspace !== workspace;
  const [reopenOpen, setReopenOpen] = useState(false);
  const activeDocument =
    workspace.documents.find(
      (document) => document.documentId === workspace.activeDocumentId,
    ) ??
    workspace.documents[0] ??
    emptyDocument;
  const state = activeDocument.tree;
  const language = hasDocument
    ? activeDocument.viewState.language
    : (workspace.closedDocuments?.[0]?.viewState.language ?? 'zh');
  const activeTab = activeDocument.viewState.activePanel;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<NodeType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<NodeStatus | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [nodeEditorOpen, setNodeEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  const [logicOpen, setLogicOpen] = useState(false);
  const [projectEditorOpen, setProjectEditorOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [removeTreeOpen, setRemoveTreeOpen] = useState(false);
  const [fileError, setFileError] = useState('');
  const [traceIds, setTraceIds] = useState<Set<string> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = copy[language];
  /* oxlint-disable react/react-compiler -- browser storage is available only after hydration */
  useEffect(() => {
    setHydrated(true);
  }, []);
  /* oxlint-enable react/react-compiler */
  useEffect(() => {
    if (!hydrated) return;
    const persist = () => {
      try {
        researchTreeRepository.saveWorkspace(workspace);
        setStorageError('');
      } catch (error) {
        setStorageError(error instanceof Error ? error.message : String(error));
      }
      setSavedWorkspace(workspace);
    };
    const timer = setTimeout(persist, 250);
    const flush = () => {
      clearTimeout(timer);
      persist();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pagehide', flush);
    };
  }, [hydrated, workspace]);
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);
  const updateActiveDocument = useCallback(
    (updater: (previous: ResearchTreeDocument) => ResearchTreeDocument) => {
      setWorkspace((previous) => ({
        ...previous,
        documents: previous.documents.map((document) =>
          document.documentId === previous.activeDocumentId
            ? { ...updater(document), savedAt: new Date().toISOString() }
            : document,
        ),
      }));
    },
    [],
  );
  const updateState = useCallback(
    (updater: (previous: ResearchProjectState) => ResearchProjectState) =>
      updateActiveDocument((document) => ({
        ...document,
        tree: (() => {
          const next = updater(document.tree);
          if (!next.canvas) return next;
          const ids = new Set([
            ...next.nodes.map((n) => n.id),
            ...next.logicSpots.map((s) => s.id),
            ...next.canvas.backgroundBlocks.map((b) => b.id),
          ]);
          return {
            ...next,
            canvas: {
              ...next.canvas,
              layerOrder: next.canvas.layerOrder.filter((id) => ids.has(id)),
            },
          };
        })(),
      })),
    [updateActiveDocument],
  );
  const setLanguage = (next: Language) =>
    updateActiveDocument((document) => ({
      ...document,
      viewState: { ...document.viewState, language: next },
    }));
  const setActiveTab = (next: string) =>
    updateActiveDocument((document) => ({
      ...document,
      viewState: {
        ...document.viewState,
        activePanel: next === 'log' ? 'log' : 'graph',
      },
    }));
  const setViewport = (viewport: Viewport) =>
    updateActiveDocument((document) => ({
      ...document,
      viewState: { ...document.viewState, viewport },
    }));
  const switchDocument = (documentId: string) => {
    setWorkspace((previous) => ({ ...previous, activeDocumentId: documentId }));
    setSelectedId(null);
    setSelectedSpotId(null);
    setTraceIds(null);
    setFileError('');
    setQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setSelectedLayerId(null);
    setNodeEditorOpen(false);
    setLogicOpen(false);
    setRelationshipOpen(false);
    setLayersOpen(false);
  };
  const selected = state.nodes.find((node) => node.id === selectedId) ?? null;
  const selectedSpot =
    state.logicSpots.find((spot) => spot.id === selectedSpotId) ?? null;

  /* oxlint-disable react/react-compiler -- recursive traversal intentionally closes over the current graph */
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    const walk = (id: string) => {
      state.edges
        .filter((edge) => edge.sourceNodeId === id)
        .forEach((edge) => {
          if (!hidden.has(edge.targetNodeId)) {
            hidden.add(edge.targetNodeId);
            walk(edge.targetNodeId);
          }
        });
      state.logicSpots
        .filter((spot) => spot.parentNodeId === id)
        .forEach((spot) =>
          spot.inputNodeIds.forEach((inputId) => {
            if (!hidden.has(inputId)) {
              hidden.add(inputId);
              walk(inputId);
            }
          }),
        );
    };
    state.collapsedNodeIds.forEach(walk);
    return hidden;
  }, [state.collapsedNodeIds, state.edges, state.logicSpots]);
  /* oxlint-enable react/react-compiler */
  const matchedIds = useMemo(
    () =>
      new Set(
        state.nodes
          .filter((node) => {
            const text = nodeText(node, language);
            const haystack =
              `${text.title} ${text.summary} ${text.notes} ${text.source}`.toLowerCase();
            return (
              !hiddenIds.has(node.id) &&
              (typeFilter === 'all' || node.type === typeFilter) &&
              (statusFilter === 'all' || node.status === statusFilter) &&
              (!query.trim() || haystack.includes(query.trim().toLowerCase()))
            );
          })
          .map((node) => node.id),
      ),
    [hiddenIds, language, query, state.nodes, statusFilter, typeFilter],
  );
  const toggleCollapse = useCallback(
    (id: string) =>
      updateState((previous) => ({
        ...previous,
        collapsedNodeIds: previous.collapsedNodeIds.includes(id)
          ? previous.collapsedNodeIds.filter((item) => item !== id)
          : [...previous.collapsedNodeIds, id],
      })),
    [updateState],
  );

  const flowNodes = useMemo<FlowNode[]>(() => {
    const research: FlowNode[] = state.nodes
      .filter((node) => matchedIds.has(node.id))
      .map((node) => ({
        id: node.id,
        type: 'research',
        position: state.positions[node.id] ?? { x: 0, y: 0 },
        data: {
          node,
          language,
          collapsed: state.collapsedNodeIds.includes(node.id),
          hasChildren:
            state.edges.some((edge) => edge.sourceNodeId === node.id) ||
            state.logicSpots.some((spot) => spot.parentNodeId === node.id),
          traced: !traceIds || traceIds.has(node.id),
          traceActive: Boolean(traceIds),
          onToggleCollapse: toggleCollapse,
        } satisfies ResearchCardData,
      }));
    const logic: FlowNode[] = state.logicSpots
      .filter(
        (spot) =>
          matchedIds.has(spot.parentNodeId) &&
          !hiddenIds.has(spot.parentNodeId),
      )
      .map((spot) => ({
        id: spot.id,
        type: 'logic',
        position: state.positions[spot.id] ?? { x: 0, y: 0 },
        data: {
          spot,
          language,
          status: evaluateLogic(spot, state.nodes),
          passing: spot.inputNodeIds.filter(
            (id) =>
              state.nodes.find((node) => node.id === id)?.status ===
              'confirmed',
          ).length,
          total: spot.inputNodeIds.length,
          traced: !traceIds || traceIds.has(spot.id),
          traceActive: Boolean(traceIds),
        } satisfies LogicCardData,
      }));
    const order = canvasOrder(state);
    const blocks: FlowNode[] = (state.canvas?.backgroundBlocks ?? []).map(
      (block) => ({
        id: block.id,
        type: 'background',
        position: state.positions[block.id] ?? { x: 0, y: 0 },
        style: { width: block.width, height: block.height },
        width: block.width,
        height: block.height,
        dragHandle: '.block-drag-handle',
        draggable: !block.locked,
        selectable: true,
        data: { block, language },
      }),
    );
    return [...blocks, ...research, ...logic].map((node) => ({
      ...node,
      zIndex: order.indexOf(node.id) - blocks.length,
      selected: node.id === selectedLayerId,
    }));
  }, [
    hiddenIds,
    language,
    matchedIds,
    state,
    selectedLayerId,
    toggleCollapse,
    traceIds,
  ]);

  const flowEdges = useMemo<FlowEdge[]>(() => {
    const semantic = state.edges
      .filter(
        (edge) =>
          matchedIds.has(edge.sourceNodeId) &&
          matchedIds.has(edge.targetNodeId),
      )
      .map((edge) => {
        const style = EDGE_STYLE[edge.relationshipType];
        const traced =
          !traceIds ||
          (traceIds.has(edge.sourceNodeId) && traceIds.has(edge.targetNodeId));
        return {
          id: edge.id,
          source: edge.sourceNodeId,
          target: edge.targetNodeId,
          label: relationshipLabels[language][edge.relationshipType],
          type: 'smoothstep',
          animated: edge.relationshipType === 'replaces',
          style: {
            stroke: style.color,
            strokeWidth: traceIds && traced ? 3 : 1.7,
            strokeDasharray: style.dash,
            opacity: traced ? 0.92 : 0.1,
          },
          labelStyle: { fill: style.color, fontSize: 11, fontWeight: 700 },
          labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.94 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: style.color,
            width: 16,
            height: 16,
          },
        };
      });
    const logical = state.logicSpots.flatMap((spot) => {
      if (
        !matchedIds.has(spot.parentNodeId) ||
        hiddenIds.has(spot.parentNodeId)
      )
        return [];
      const traced = !traceIds || traceIds.has(spot.id);
      const base = {
        type: 'smoothstep',
        style: {
          stroke: '#334155',
          strokeWidth: traceIds && traced ? 3 : 2.2,
          opacity: traced ? 0.85 : 0.1,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#334155',
          width: 15,
          height: 15,
        },
        labelStyle: { fill: '#334155', fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.95 },
      };
      return [
        {
          ...base,
          id: `logic-parent-${spot.id}`,
          source: spot.parentNodeId,
          target: spot.id,
          label: t.parentToSpot,
        },
        ...spot.inputNodeIds
          .filter((id) => matchedIds.has(id))
          .map((id) => ({
            ...base,
            id: `logic-input-${spot.id}-${id}`,
            source: spot.id,
            target: id,
            label: t.spotToInput,
          })),
      ];
    });
    return [...semantic, ...logical];
  }, [
    hiddenIds,
    language,
    matchedIds,
    state.edges,
    state.logicSpots,
    t.parentToSpot,
    t.spotToInput,
    traceIds,
  ]);

  const saveNode = (draft: NodeDraft) => {
    const now = new Date().toISOString();
    updateState((previous) => {
      if (editingId) {
        const next = {
          ...previous,
          nodes: previous.nodes.map((node) =>
            node.id === editingId
              ? { ...node, ...draft, updatedAt: now }
              : node,
          ),
          decisionLog: [
            {
              id: crypto.randomUUID(),
              nodeId: editingId,
              action: 'updated' as const,
              summary: localized(
                `Updated: ${draft.content.en.title}`,
                `已更新：${draft.content.zh.title}`,
              ),
              timestamp: now,
            },
            ...previous.decisionLog,
          ],
        };
        return applyLogicStatuses(next);
      }
      const id = crypto.randomUUID();
      const anchor = selectedId ? previous.positions[selectedId] : undefined;
      const newNode: ResearchNode = {
        languageType: 'en-zh',
        id,
        ...draft,
        createdAt: now,
        updatedAt: now,
        end: 'end',
      };
      return applyLogicStatuses({
        ...previous,
        nodes: [...previous.nodes, newNode],
        positions: {
          ...previous.positions,
          [id]: anchor
            ? { x: anchor.x + 330, y: anchor.y + 180 }
            : { x: 180, y: 180 },
        },
        decisionLog: [
          {
            id: crypto.randomUUID(),
            nodeId: id,
            action: 'created',
            summary: localized(
              `Created: ${draft.content.en.title}`,
              `已创建：${draft.content.zh.title}`,
            ),
            timestamp: now,
          },
          ...previous.decisionLog,
        ],
      });
    });
  };
  const saveRelationship = (
    sourceId: string,
    targetId: string,
    relationshipType: RelationshipType,
    note: string,
  ) => {
    const now = new Date().toISOString();
    updateState((previous) => {
      const target = previous.nodes.find((node) => node.id === targetId);
      const source = previous.nodes.find((node) => node.id === sourceId);
      const shouldReview =
        (relationshipType === 'contradicts' ||
          relationshipType === 'modifies') &&
        target &&
        ['assumption', 'judgement', 'decision'].includes(target.type) &&
        !['rejected', 'supersededReopened'].includes(target.status);
      const nextStatus: NodeStatus | undefined =
        relationshipType === 'replaces'
          ? 'supersededReopened'
          : shouldReview
            ? 'needsVerification'
            : undefined;
      const nodes = nextStatus
        ? previous.nodes.map((node) =>
            node.id === targetId
              ? { ...node, status: nextStatus, updatedAt: now }
              : node,
          )
        : previous.nodes;
      const edge: ResearchEdge = {
        id: crypto.randomUUID(),
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        relationshipType,
        note: localized(note, note),
        createdAt: now,
      };
      const relationSummary = localized(
        `${nodeText(source!, 'en').title} ${relationshipLabels.en[relationshipType]} ${nodeText(target!, 'en').title}`,
        `${nodeText(source!, 'zh').title}${relationshipLabels.zh[relationshipType]}${nodeText(target!, 'zh').title}`,
      );
      return applyLogicStatuses({
        ...previous,
        nodes,
        edges: [...previous.edges, edge],
        decisionLog: [
          {
            id: crypto.randomUUID(),
            nodeId: targetId,
            action: 'relationship',
            summary: relationSummary,
            timestamp: now,
          },
          ...previous.decisionLog,
        ],
      });
    });
  };
  const saveLogicSpot = (
    parentNodeId: string,
    inputNodeIds: string[],
    logicType: LogicSpotType,
    threshold: number,
  ) => {
    const now = new Date().toISOString();
    updateState((previous) => {
      const id = crypto.randomUUID();
      const parent = previous.nodes.find((node) => node.id === parentNodeId)!;
      const parentPosition = previous.positions[parentNodeId] ?? { x: 0, y: 0 };
      const spot: LogicSpot = {
        languageType: 'en-zh',
        id,
        label: localized(
          `Verification of ${nodeText(parent, 'en').title}`,
          `${nodeText(parent, 'zh').title}的验证`,
        ),
        logicType,
        threshold:
          logicType === 'atLeastK'
            ? Math.max(1, Math.min(threshold, inputNodeIds.length))
            : null,
        parentNodeId,
        inputNodeIds,
        createdAt: now,
        updatedAt: now,
        end: 'end',
      };
      const positions = {
        ...previous.positions,
        [id]: { x: parentPosition.x + 330, y: parentPosition.y + 55 },
      };
      inputNodeIds.forEach((inputId, index) => {
        positions[inputId] = {
          x: parentPosition.x + 590,
          y: parentPosition.y + (index - (inputNodeIds.length - 1) / 2) * 220,
        };
      });
      return applyLogicStatuses({
        ...previous,
        logicSpots: [...previous.logicSpots, spot],
        positions,
        decisionLog: [
          {
            id: crypto.randomUUID(),
            nodeId: parentNodeId,
            action: 'logicSpot',
            summary: localized(
              `${logicSpotLabels.en[logicType]} verification rule added.`,
              `已添加${logicSpotLabels.zh[logicType]}验证规则。`,
            ),
            timestamp: now,
          },
          ...previous.decisionLog,
        ],
      });
    });
  };
  const changeStatus = (status: NodeStatus) => {
    if (!selected) return;
    const now = new Date().toISOString();
    updateState((previous) =>
      applyLogicStatuses({
        ...previous,
        nodes: previous.nodes.map((node) =>
          node.id === selected.id ? { ...node, status, updatedAt: now } : node,
        ),
        decisionLog: [
          {
            id: crypto.randomUUID(),
            nodeId: selected.id,
            action: 'statusChanged',
            summary: localized(
              `${nodeText(selected, 'en').title}: ${statusLabels.en[selected.status]} → ${statusLabels.en[status]}`,
              `${nodeText(selected, 'zh').title}：${statusLabels.zh[selected.status]} → ${statusLabels.zh[status]}`,
            ),
            timestamp: now,
          },
          ...previous.decisionLog,
        ],
      }),
    );
  };
  const deleteSelection = () => {
    if (
      selectedId &&
      state.logicSpots.some((spot) => spot.inputNodeIds.includes(selectedId))
    ) {
      setFileError(
        language === 'zh'
          ? '此节点是形式逻辑的输入。请先移除或修改相关逻辑点，再删除节点。'
          : 'This node is a formal input. Remove or update its logic rule before deleting the node.',
      );
      setDeleteOpen(false);
      return;
    }
    if (selectedSpotId) {
      updateState((previous) => {
        const spot = previous.logicSpots.find(
          (item) => item.id === selectedSpotId,
        );
        return {
          ...previous,
          logicSpots: previous.logicSpots.filter(
            (item) => item.id !== selectedSpotId,
          ),
          positions: Object.fromEntries(
            Object.entries(previous.positions).filter(
              ([id]) => id !== selectedSpotId,
            ),
          ),
          nodes: previous.nodes.map((node) =>
            node.id === spot?.parentNodeId
              ? { ...node, status: 'needsVerification' }
              : node,
          ),
        };
      });
      setSelectedSpotId(null);
    } else if (selectedId) {
      updateState((previous) =>
        applyLogicStatuses({
          ...previous,
          nodes: previous.nodes.filter((node) => node.id !== selectedId),
          edges: previous.edges.filter(
            (edge) =>
              edge.sourceNodeId !== selectedId &&
              edge.targetNodeId !== selectedId,
          ),
          logicSpots: previous.logicSpots
            .filter((spot) => spot.parentNodeId !== selectedId)
            .map((spot) => ({
              ...spot,
              inputNodeIds: spot.inputNodeIds.filter((id) => id !== selectedId),
            }))
            .filter((spot) => spot.inputNodeIds.length),
          positions: Object.fromEntries(
            Object.entries(previous.positions).filter(
              ([id]) => id !== selectedId,
            ),
          ),
          collapsedNodeIds: previous.collapsedNodeIds.filter(
            (id) => id !== selectedId,
          ),
          decisionLog: [
            ...previous.decisionLog,
            {
              id: crypto.randomUUID(),
              nodeId: selectedId!,
              action: 'updated',
              summary: localized(
                'Node removed from the canvas; its reasoning history is retained.',
                '节点已从画布移除，相关推理历史仍保留。',
              ),
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      );
      setSelectedId(null);
    }
    setDeleteOpen(false);
    setTraceIds(null);
  };
  const traceEvidence = () => {
    if (!selected || !['decision', 'judgement'].includes(selected.type)) return;
    const traced = new Set<string>([selected.id]);
    const walk = (id: string) => {
      state.edges
        .filter((edge) => edge.targetNodeId === id)
        .forEach((edge) => {
          if (!traced.has(edge.sourceNodeId)) {
            traced.add(edge.sourceNodeId);
            walk(edge.sourceNodeId);
          }
        });
      state.logicSpots
        .filter((spot) => spot.parentNodeId === id)
        .forEach((spot) => {
          traced.add(spot.id);
          spot.inputNodeIds.forEach((inputId) => {
            traced.add(inputId);
            walk(inputId);
          });
        });
    };
    walk(selected.id);
    setTraceIds(traced);
    setSelectedId(null);
  };
  const downloadJson = (node: ResearchNode) => {
    const blob = new Blob([serializeNode(node)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${node.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const createTree = (
    title: LocalizedText,
    researchQuestion: LocalizedText,
  ) => {
    const document = createBlankResearchTreeDocument(
      title,
      researchQuestion,
      language,
    );
    setWorkspace((previous) => ({
      ...previous,
      activeDocumentId: document.documentId,
      documents: [...previous.documents, document],
    }));
    setSelectedId(null);
    setSelectedSpotId(null);
    setTraceIds(null);
  };
  const exportTree = () => {
    const blob = new Blob([serializeResearchTreeDocument(activeDocument)], {
      type: 'application/vnd.research-tree+json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeTitle =
      activeDocument.tree.project.title.en
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'research-tree';
    anchor.href = url;
    anchor.download = `${safeTitle}.research-tree.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const importTree = async (file?: File) => {
    if (!file) return;
    try {
      const imported = parseResearchTreeDocument(await file.text());
      const nextDocument = {
        ...imported,
        tree: applyLogicStatuses(imported.tree),
      };
      // Keep the previous revision recoverable before a same-ID import.
      const previousDocument = [
        ...workspace.documents,
        ...(workspace.closedDocuments ?? []),
      ].find((d) => d.documentId === nextDocument.documentId);
      if (previousDocument && !workspace.loadError)
        localStorage.setItem(
          'research-tree.import-backup.' + nextDocument.documentId,
          serializeResearchTreeDocument(previousDocument),
        );
      setWorkspace((previous) => upsertDocument(previous, nextDocument));
      // React Flow only reads defaultViewport on mount, including same-ID imports.
      setCanvasImportRevision((revision) => revision + 1);
      setQuery('');
      setTypeFilter('all');
      setStatusFilter('all');
      setSelectedLayerId(null);
      setLayersOpen(false);
      setSelectedId(null);
      setSelectedSpotId(null);
      setTraceIds(null);
      setFileError('');
    } catch (error) {
      setFileError(
        `${t.invalidTreeFile} ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const removeActiveTree = () => {
    setWorkspace((previous) => {
      const remaining = previous.documents.filter(
        (document) => document.documentId !== previous.activeDocumentId,
      );
      if (remaining.length)
        return {
          ...previous,
          activeDocumentId: remaining[0].documentId,
          documents: remaining,
        };
      return { ...previous, activeDocumentId: '', documents: [] };
    });
    setSelectedId(null);
    setSelectedSpotId(null);
    setTraceIds(null);
    setRemoveTreeOpen(false);
  };

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<typeof context.registerTool>[0]) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => undefined);
      } catch {
        /* unsupported */
      }
    };
    register({
      name: 'list_research_nodes',
      title: 'List research nodes',
      description: 'Read locally saved nodes in one requested language.',
      inputSchema: {
        type: 'object',
        properties: {
          language: { type: 'string', enum: ['en', 'zh'] },
          type: { type: 'string', enum: NODE_TYPES },
          status: { type: 'string', enum: NODE_STATUSES },
        },
        required: ['language'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        const filter = input as {
          language: Language;
          type?: NodeType;
          status?: NodeStatus;
        };
        if (!['en', 'zh'].includes(filter.language))
          throw new Error('language must be en or zh');
        return {
          nodes: state.nodes
            .filter(
              (node) =>
                (!filter.type || node.type === filter.type) &&
                (!filter.status || node.status === filter.status),
            )
            .map((node) => ({
              id: node.id,
              type: node.type,
              status: node.status,
              ...nodeText(node, filter.language),
            })),
        };
      },
    });
    register({
      name: 'create_research_node',
      title: 'Create bilingual research node',
      description: 'Create one locally persisted EN/ZH JSON node.',
      inputSchema: {
        type: 'object',
        properties: {
          titleEn: { type: 'string', minLength: 1 },
          titleZh: { type: 'string', minLength: 1 },
          type: { type: 'string', enum: NODE_TYPES },
          status: { type: 'string', enum: NODE_STATUSES },
          summaryEn: { type: 'string' },
          summaryZh: { type: 'string' },
        },
        required: ['titleEn', 'titleZh', 'type'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        const value = input as {
          titleEn?: string;
          titleZh?: string;
          type?: NodeType;
          status?: NodeStatus;
          summaryEn?: string;
          summaryZh?: string;
        };
        if (
          !value.titleEn?.trim() ||
          !value.titleZh?.trim() ||
          !NODE_TYPES.includes(value.type as NodeType)
        )
          throw new Error('Both titles and a valid node type are required.');
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const node: ResearchNode = {
          languageType: 'en-zh',
          id,
          type: value.type as NodeType,
          status: NODE_STATUSES.includes(value.status as NodeStatus)
            ? (value.status as NodeStatus)
            : 'tentative',
          content: {
            en: {
              ...emptyContent(),
              title: value.titleEn.trim(),
              summary: value.summaryEn ?? '',
            },
            zh: {
              ...emptyContent(),
              title: value.titleZh.trim(),
              summary: value.summaryZh ?? '',
            },
          },
          createdAt: now,
          updatedAt: now,
          end: 'end',
        };
        updateState((previous) => ({
          ...previous,
          nodes: [...previous.nodes, node],
          positions: {
            ...previous.positions,
            [id]: { x: 240, y: 160 + previous.nodes.length * 12 },
          },
        }));
        return {
          id,
          languageType: node.languageType,
          end: node.end,
          persisted: true,
        };
      },
    });
    return () => lifecycle.abort();
  }, [state.nodes, updateState]);

  const selectedContent = selected ? nodeText(selected, language) : null;
  const connectedEdges = selected
    ? state.edges.filter(
        (edge) =>
          edge.sourceNodeId === selected.id ||
          edge.targetNodeId === selected.id,
      )
    : [];
  const impactEdges = selected
    ? state.edges.filter(
        (edge) =>
          edge.targetNodeId === selected.id &&
          ['contradicts', 'modifies', 'replaces'].includes(
            edge.relationshipType,
          ),
      )
    : [];
  const nodeById = (id: string) => state.nodes.find((node) => node.id === id);
  const parentSpot = selected
    ? state.logicSpots.find((spot) => spot.parentNodeId === selected.id)
    : undefined;
  const actionLabels: Record<string, string> = {
    created: t.logCreated,
    updated: t.logUpdated,
    statusChanged: t.logStatus,
    impact: t.logImpact,
    relationship: t.logRelationship,
    logicSpot: t.logLogicSpot,
    logicSpotCreated: t.logLogicSpot,
    impactRecorded: t.logImpact,
    replaced: language === 'zh' ? '已取代' : 'Replaced',
  };
  const typeOptions = ['all', ...NODE_TYPES] as const;
  const statusOptions = ['all', ...NODE_STATUSES] as const;
  const typeLabels = { all: t.allTypes, ...nodeTypeLabels[language] } as Record<
    (typeof typeOptions)[number],
    string
  >;
  const statusFilterLabels = {
    all: t.allStatuses,
    ...statusLabels[language],
  } as Record<(typeof statusOptions)[number], string>;

  if (!hydrated)
    return (
      <main className="grid h-dvh min-h-[640px] place-items-center bg-[#edf2f4] text-sm font-semibold text-slate-500">
        Research Tree
      </main>
    );

  return (
    <TooltipProvider>
      <main className="flex h-dvh min-h-[640px] flex-col overflow-hidden bg-[#edf2f4] text-slate-900">
        <header className="z-20 flex h-[70px] shrink-0 items-center justify-between border-b border-slate-200 bg-[#f8fafb] px-4 shadow-[0_2px_12px_rgba(16,35,52,.04)] lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#173a4d] text-white">
              <Network className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight text-[#142c3b]">
                {t.appName}
              </h1>
              <p className="hidden text-xs font-medium text-slate-500 sm:block">
                {t.appTagline}
              </p>
            </div>
          </div>
          <div className="hidden min-w-0 flex-1 px-8 lg:block">
            <p className="truncate text-center text-sm font-semibold text-slate-700">
              {state.project.title[language]}
            </p>
            <p className="truncate text-center text-xs text-slate-500">
              {state.project.researchQuestion[language]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden gap-1.5 bg-white text-slate-600 md:flex"
            >
              <FileJson2 className="size-3.5" />
              {t.jsonFormat}
            </Badge>
            <Badge
              variant="outline"
              className="hidden gap-1.5 bg-emerald-50 text-emerald-700 xl:flex"
            >
              <span className="size-2 rounded-full bg-emerald-500" />
              {storageError || workspace.loadError
                ? language === 'zh'
                  ? '本机保存失败'
                  : 'Local save failed'
                : saving
                  ? language === 'zh'
                    ? '正在保存…'
                    : 'Saving…'
                  : t.localSaved}
            </Badge>
            <div className="flex items-center rounded-lg border bg-white p-0.5">
              <Languages className="ml-1.5 size-4 text-slate-500" />
              <Button
                size="sm"
                variant={language === 'en' ? 'secondary' : 'ghost'}
                className="h-8 px-2"
                onClick={() => setLanguage('en')}
              >
                EN
              </Button>
              <Button
                size="sm"
                variant={language === 'zh' ? 'secondary' : 'ghost'}
                className="h-8 px-2"
                onClick={() => setLanguage('zh')}
              >
                中文
              </Button>
            </div>
          </div>
        </header>
        <input
          ref={fileInputRef}
          type="file"
          accept=".research-tree.json,.json,application/json"
          className="hidden"
          onChange={(event) => void importTree(event.target.files?.[0])}
        />
        <div className="z-20 flex h-[48px] shrink-0 items-center gap-2 border-b border-slate-200 bg-[#e8eef1] px-3 lg:px-5">
          <div className="hidden shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-500 md:flex">
            <FileJson2 className="size-3.5" />
            {t.trees}
          </div>
          <div
            role="tablist"
            aria-label={t.trees}
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-1"
          >
            {workspace.documents.map((document) => (
              <div
                key={document.documentId}
                className="flex shrink-0 items-center rounded-md bg-white/50"
              >
                <button
                  role="tab"
                  aria-selected={
                    document.documentId === activeDocument.documentId
                  }
                  className={cn(
                    'max-w-[230px] shrink-0 truncate rounded-md border px-3 py-1.5 text-xs font-semibold transition',
                    document.documentId === activeDocument.documentId
                      ? 'border-[#2c6677] bg-white text-[#173a4d] shadow-sm'
                      : 'border-transparent text-slate-600 hover:border-slate-300 hover:bg-white/70',
                  )}
                  onClick={() => switchDocument(document.documentId)}
                >
                  {document.tree.project.title[language]}
                </button>
                <button
                  className="rounded p-1.5 text-slate-500 hover:bg-slate-200"
                  aria-label={`${language === 'zh' ? '关闭标签' : 'Close tab'}: ${document.tree.project.title[language]}`}
                  title={
                    language === 'zh'
                      ? '关闭并保留在本机'
                      : 'Close and keep locally'
                  }
                  onClick={() => {
                    setWorkspace((previous) =>
                      closeDocument(previous, document.documentId),
                    );
                    if (document.documentId === activeDocument.documentId) {
                      setSelectedId(null);
                      setSelectedSpotId(null);
                      setSelectedLayerId(null);
                      setLayersOpen(false);
                    }
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReopenOpen(true)}
              disabled={!workspace.closedDocuments?.length}
            >
              {language === 'zh' ? '重新打开' : 'Reopen'} (
              {workspace.closedDocuments?.length ?? 0})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-white"
              title={t.newTree}
              onClick={() => setProjectEditorOpen(true)}
            >
              <FolderPlus />
              <span className="hidden xl:inline">{t.newTree}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-white"
              title={t.openTree}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload />
              <span className="hidden xl:inline">{t.openTree}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-white"
              title={t.saveTree}
              disabled={!hasDocument}
              onClick={exportTree}
            >
              <Download />
              <span className="hidden xl:inline">{t.saveTree}</span>
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-slate-500 hover:text-red-600"
              title={t.removeTree}
              disabled={!hasDocument}
              onClick={() => setRemoveTreeOpen(true)}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
        {fileError && (
          <div
            role="alert"
            className="z-30 flex shrink-0 items-center justify-between border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-medium text-red-700"
          >
            <span>{fileError}</span>
            <button
              type="button"
              onClick={() => setFileError('')}
              aria-label={t.close}
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        {(storageError || workspace.loadError) && (
          <div
            role="alert"
            className="border-b border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {language === 'zh'
              ? '本机数据未覆盖。请导出备份后检查：'
              : 'Local data has not been overwritten. Export a backup and check: '}
            {storageError || workspace.loadError}
            <Button
              variant="outline"
              size="sm"
              className="ml-3"
              onClick={() => {
                const raw = localStorage.getItem('research-tree.workspace.v3');
                if (!raw) return;
                const url = URL.createObjectURL(
                  new Blob([raw], { type: 'application/json' }),
                );
                const a = document.createElement('a');
                a.href = url;
                a.download = 'research-tree-workspace-recovery.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              {language === 'zh'
                ? '导出原始工作区'
                : 'Export original workspace'}
            </Button>
          </div>
        )}
        {hasDocument ? (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className="flex h-[56px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 lg:px-5">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-label={t.filters}
                >
                  {filtersOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
                </Button>
                <TabsList>
                  <TabsTrigger value="graph">
                    <Network />
                    {t.graph}
                  </TabsTrigger>
                  <TabsTrigger value="log">
                    <Clock3 />
                    {t.log}
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="flex items-center gap-2">
                {traceIds && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTraceIds(null)}
                  >
                    <X />
                    {t.clearTrace}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLayersOpen(!layersOpen)}
                >
                  <Layers />
                  {language === 'zh' ? '背景与图层' : 'Backgrounds & layers'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLogicOpen(true)}
                >
                  <Sigma />
                  <span className="hidden md:inline">{t.addLogicSpot}</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRelationshipOpen(true)}
                >
                  <Link2 />
                  <span className="hidden sm:inline">{t.connect}</span>
                </Button>
                <Button
                  size="sm"
                  className="bg-[#173a4d] hover:bg-[#214d64]"
                  onClick={() => {
                    setEditingId(null);
                    setNodeEditorOpen(true);
                  }}
                >
                  <Plus />
                  <span className="hidden sm:inline">{t.addNode}</span>
                </Button>
              </div>
            </div>
            <TabsContent
              value="graph"
              className="relative m-0 min-h-0 flex-1 overflow-hidden"
            >
              <div className="flex h-full min-h-0">
                {filtersOpen && (
                  <aside className="z-10 w-[272px] shrink-0 border-r border-slate-200 bg-[#f8fafb] p-4 max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:shadow-xl">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#1d3545]">
                        <Filter className="size-4" />
                        {t.filters}
                      </div>
                      <span className="text-xs font-medium text-slate-500">
                        {matchedIds.size} {t.nodesVisible}
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        className="bg-white pl-8"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t.search}
                      />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {t.filterHint}
                    </p>
                    <Separator className="my-4" />
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>{t.nodeType}</Label>
                        <AppSelect
                          value={typeFilter}
                          onValueChange={setTypeFilter}
                          options={typeOptions}
                          labels={typeLabels}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>{t.status}</Label>
                        <AppSelect
                          value={statusFilter}
                          onValueChange={setStatusFilter}
                          options={statusOptions}
                          labels={statusFilterLabels}
                        />
                      </div>
                    </div>
                    <Separator className="my-4" />
                    <div className="grid gap-2">
                      <Button
                        variant="outline"
                        className="justify-start bg-white"
                        onClick={() =>
                          updateState((previous) => ({
                            ...previous,
                            collapsedNodeIds: previous.nodes
                              .filter(
                                (node) =>
                                  previous.edges.some(
                                    (edge) => edge.sourceNodeId === node.id,
                                  ) ||
                                  previous.logicSpots.some(
                                    (spot) => spot.parentNodeId === node.id,
                                  ),
                              )
                              .map((node) => node.id),
                          }))
                        }
                      >
                        <ChevronRight />
                        {t.collapseAll}
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start bg-white"
                        onClick={() =>
                          updateState((previous) => ({
                            ...previous,
                            collapsedNodeIds: [],
                          }))
                        }
                      >
                        <ChevronDown />
                        {t.expandAll}
                      </Button>
                      <Button
                        variant="ghost"
                        className="mt-2 justify-start text-slate-500"
                        onClick={() => setResetOpen(true)}
                      >
                        <RotateCcw />
                        {t.resetDemo}
                      </Button>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                        {t.projectQuestion}
                      </p>
                      <p className="mt-1 line-clamp-4 text-sm leading-5 text-slate-700">
                        {state.project.researchQuestion[language]}
                      </p>
                    </div>
                  </aside>
                )}
                <section className="relative min-w-0 flex-1 bg-[#edf2f4]">
                  {(state.canvas?.backgroundBlocks.length ?? 0) > 0 && (
                    <nav aria-label={language === 'zh' ? '分区导航' : 'Section navigation'}
                      className="absolute left-3 top-3 right-3 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-sm">
                      <span className="px-1 text-sm font-semibold text-slate-600">{language === 'zh' ? '分区' : 'Sections'}</span>
                      {state.canvas!.backgroundBlocks.map((block) => (
                        <Button key={block.id} size="sm" variant="outline"
                          className="max-w-full whitespace-normal text-left"
                          style={{borderLeft: `4px solid ${block.color}`}}
                          onClick={() => {
                            const p = state.positions[block.id];
                            if (!p) return;
                            setQuery(''); setTypeFilter('all'); setStatusFilter('all'); setTraceIds(null);
                            setSelectedId(null); setSelectedSpotId(null); setLayersOpen(false);
                            setSelectedLayerId(block.id);
                            // Focus the entrance at readable scale, not a tall block's full bounds.
                            void flowRef.current?.setViewport({x: 28 - p.x * .85, y: 100 - p.y * .85, zoom: .85}, {duration: 250});
                          }}>
                          {block.title[language]}
                        </Button>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => void flowRef.current?.fitView({padding: .12, duration: 250})}>
                        {language === 'zh' ? '全图' : 'Overview'}
                      </Button>
                    </nav>
                  )}
                  {layersOpen && (
                    <CanvasPanel
                      state={state}
                      language={language}
                      selectedId={selectedLayerId}
                      onSelect={setSelectedLayerId}
                      onChange={updateState}
                      onClose={() => setLayersOpen(false)}
                      onAdd={() => {
                        const id = crypto.randomUUID();
                        const viewport =
                          flowRef.current?.getViewport() ??
                          activeDocument.viewState.viewport;
                        updateState((previous) => ({
                          ...previous,
                          positions: {
                            ...previous.positions,
                            [id]: {
                              x: (80 - viewport.x) / viewport.zoom,
                              y: (80 - viewport.y) / viewport.zoom,
                            },
                          },
                          canvas: {
                            backgroundBlocks: [
                              ...(previous.canvas?.backgroundBlocks ?? []),
                              {
                                id,
                                title: localized('Background block', '背景块'),
                                color: '#6b9eaa',
                                width: 680,
                                height: 460,
                                locked: false,
                              },
                            ],
                            layerOrder: [id, ...canvasOrder(previous)],
                          },
                        }));
                        setSelectedLayerId(id);
                      }}
                    />
                  )}
                  {flowNodes.length ? (
                    <ReactFlow
                      key={`${activeDocument.documentId}:${canvasImportRevision}`}
                      nodes={flowNodes}
                      edges={flowEdges}
                      onInit={(instance) => {
                        flowRef.current = instance;
                      }}
                      elevateNodesOnSelect={false}
                      nodesConnectable={false}
                      deleteKeyCode={null}
                      onNodesChange={(changes) => {
                        if (
                          !changes.some(
                            (c) =>
                              (c.type === 'position' && c.position) ||
                              (c.type === 'dimensions' &&
                                c.resizing &&
                                c.dimensions),
                          )
                        )
                          return;
                        updateState((previous) => {
                          const positions = { ...previous.positions };
                          let blocks = previous.canvas?.backgroundBlocks ?? [];
                          let changed = false;
                          for (const change of changes) {
                            if (change.type === 'position' && change.position) {
                              positions[change.id] = change.position;
                              changed = true;
                            }
                            if (
                              change.type === 'dimensions' &&
                              change.resizing &&
                              change.dimensions
                            ) {
                              const size = change.dimensions;
                              blocks = blocks.map((b) =>
                                b.id === change.id
                                  ? {
                                      ...b,
                                      width: Math.max(160, size.width),
                                      height: Math.max(160, size.height),
                                    }
                                  : b,
                              );
                              changed = true;
                            }
                          }
                          return changed
                            ? {
                                ...previous,
                                positions,
                                canvas: {
                                  backgroundBlocks: blocks,
                                  layerOrder: canvasOrder(previous),
                                },
                              }
                            : previous;
                        });
                      }}
                      nodeTypes={flowNodeTypes}
                      defaultViewport={activeDocument.viewState.viewport}
                      minZoom={0.08}
                      maxZoom={1.7}
                      onMoveEnd={(_, viewport) => setViewport(viewport)}
                      onNodeClick={(_, node) => {
                        setSelectedLayerId(node.id);
                        if (node.type === 'background') {
                          setLayersOpen(true);
                          setSelectedId(null);
                          setSelectedSpotId(null);
                          return;
                        }
                        if (layersOpen) return;
                        if (node.type === 'logic') {
                          setSelectedSpotId(node.id);
                          setSelectedId(null);
                        } else {
                          setSelectedId(node.id);
                          setSelectedSpotId(null);
                        }
                      }}
                      onNodeDragStop={(_, node) =>
                        updateState((previous) => ({
                          ...previous,
                          positions: {
                            ...previous.positions,
                            [node.id]: node.position,
                          },
                        }))
                      }
                    >
                      <Background color="#cbd5dc" gap={22} size={1} />
                      <Controls
                        position="bottom-right"
                        className="!overflow-hidden !rounded-lg !border-slate-200 !shadow-md"
                      />
                      <MiniMap
                        position="bottom-left"
                        nodeColor={(node) =>
                          node.type === 'background'
                            ? '#b5cbd2'
                            : node.type === 'logic'
                              ? '#334155'
                              : STATUS_STYLE[
                                  (node.data as unknown as ResearchCardData)
                                    .node.status
                                ].color
                        }
                        maskColor="rgba(232,238,241,.75)"
                        className="!border !border-slate-200 !bg-white !shadow-md"
                      />
                    </ReactFlow>
                  ) : (
                    <div className="grid h-full place-items-center">
                      <div className="text-center text-slate-500">
                        <FileSearch className="mx-auto mb-3 size-8" />
                        <p className="text-sm font-medium">{t.noResults}</p>
                      </div>
                    </div>
                  )}
                  <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg border border-white/70 bg-white/85 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm backdrop-blur">
                    {t.canvasHelp}
                  </div>
                </section>
              </div>
            </TabsContent>
            <TabsContent
              value="log"
              className="m-0 min-h-0 flex-1 overflow-hidden bg-[#f2f5f6]"
            >
              <ScrollArea className="h-full">
                <div className="mx-auto max-w-4xl px-5 py-8 lg:px-10">
                  <div className="mb-7 flex items-end justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-teal-700">
                        {t.latestFirst}
                      </p>
                      <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#173246]">
                        {t.log}
                      </h2>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      {state.nodes.length} {t.nodeCount}
                      <br />
                      {state.edges.length + state.logicSpots.length}{' '}
                      {t.relationshipCount}
                    </div>
                  </div>
                  <ol className="relative border-l border-slate-300 pl-7">
                    {[...state.decisionLog]
                      .sort(
                        (a, b) =>
                          +new Date(b.timestamp) - +new Date(a.timestamp),
                      )
                      .map((entry) => {
                        const node = nodeById(entry.nodeId);
                        return (
                          <li
                            key={entry.id}
                            className="relative mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <span className="absolute -left-[35px] top-5 size-3.5 rounded-full border-2 border-white bg-[#2c7780] ring-1 ring-slate-300" />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="bg-slate-50"
                                >
                                  {Object.hasOwn(actionLabels, entry.action) ? actionLabels[entry.action] : entry.action}
                                </Badge>
                                {node && (
                                  <button
                                    className="text-xs font-semibold text-[#265b70] hover:underline"
                                    onClick={() => {
                                      setSelectedId(node.id);
                                      setActiveTab('graph');
                                    }}
                                  >
                                    {nodeText(node, language).title}
                                  </button>
                                )}
                              </div>
                              <time className="text-xs text-slate-500">
                                {formatDate(entry.timestamp, language)}
                              </time>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-700">
                              {entry.summary[language]}
                            </p>
                          </li>
                        );
                      })}
                  </ol>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="grid flex-1 place-items-center">
            <div className="max-w-md space-y-4 p-6 text-center">
              <Network className="mx-auto size-10 text-slate-500" />
              <h2 className="text-xl font-semibold">
                {language === 'zh' ? '没有打开的研究树' : 'No open trees'}
              </h2>
              <p className="text-sm text-slate-500">
                {language === 'zh'
                  ? '关闭的研究树仍保存在本机，可以从“重新打开”恢复，也可以导入或新建研究树。'
                  : 'Closed trees are kept locally. Reopen one, import a file, or create a new tree.'}
              </p>
              <Button onClick={() => fileInputRef.current?.click()}>
                {t.openTree}
              </Button>
            </div>
          </div>
        )}
        <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {language === 'zh' ? '重新打开研究树' : 'Reopen a tree'}
              </DialogTitle>
              <DialogDescription>
                {language === 'zh'
                  ? '保存在这台设备上的已关闭研究树。'
                  : 'Closed trees saved on this device.'}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {workspace.closedDocuments?.map((d) => (
                <Button
                  key={d.documentId}
                  variant="outline"
                  className="w-full justify-start truncate"
                  onClick={() => {
                    setWorkspace((previous) =>
                      reopenDocument(previous, d.documentId),
                    );
                    setReopenOpen(false);
                  }}
                >
                  {d.tree.project.title[language]}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        <Sheet
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
        >
          <SheetContent className="w-full gap-0 p-0 sm:max-w-[520px]">
            {selected && selectedContent && (
              <>
                <SheetHeader className="border-b border-slate-200 px-6 pb-5 pt-6">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline">
                      {nodeTypeLabels[language][selected.type]}
                    </Badge>
                    <Badge
                      variant="outline"
                      style={{
                        color: STATUS_STYLE[selected.status].color,
                        background: STATUS_STYLE[selected.status].soft,
                      }}
                    >
                      {statusLabels[language][selected.status]}
                    </Badge>
                  </div>
                  <SheetTitle className="pr-8 text-xl leading-7">
                    {selectedContent.title}
                  </SheetTitle>
                  <SheetDescription className="leading-5">
                    {selectedContent.summary}
                  </SheetDescription>
                </SheetHeader>
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-6 px-6 py-5">
                    <section>
                      <p className="detail-label">{t.changeStatus}</p>
                      {parentSpot ? (
                        <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-600">
                          <Workflow className="mr-2 inline size-4" />
                          {logicSpotLabels[language][parentSpot.logicType]} ·{' '}
                          {
                            statusLabels[language][
                              evaluateLogic(parentSpot, state.nodes)
                            ]
                          }
                        </div>
                      ) : (
                        <AppSelect
                          value={selected.status}
                          onValueChange={changeStatus}
                          options={NODE_STATUSES}
                          labels={statusLabels[language]}
                        />
                      )}
                    </section>
                    <section>
                      <p className="detail-label">{t.why}</p>
                      <p className="detail-copy">
                        {selectedContent.notes || '—'}
                      </p>
                    </section>
                    <section>
                      <p className="detail-label">{t.source}</p>
                      <p className="detail-copy break-words">
                        {selectedContent.source || '—'}
                      </p>
                    </section>
                    <section>
                      <p className="detail-label">{t.assumptions}</p>
                      {selectedContent.assumptions.length ? (
                        <ul className="space-y-2">
                          {selectedContent.assumptions.map(
                            (assumption, index) => (
                              <li
                                key={`${assumption}-${index}`}
                                className="flex gap-2 text-sm leading-5 text-slate-700"
                              >
                                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" />
                                {assumption}
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <p className="detail-copy">—</p>
                      )}
                    </section>
                    <section>
                      <p className="detail-label">{t.impactHistory}</p>
                      {impactEdges.length ? (
                        <div className="space-y-2">
                          {impactEdges.map((edge) => (
                            <button
                              key={edge.id}
                              className="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-left"
                              onClick={() => setSelectedId(edge.sourceNodeId)}
                            >
                              <span className="text-xs font-bold uppercase tracking-wide text-amber-700">
                                {
                                  relationshipLabels[language][
                                    edge.relationshipType
                                  ]
                                }
                              </span>
                              <p className="mt-1 text-sm font-semibold text-slate-800">
                                {nodeById(edge.sourceNodeId) &&
                                  nodeText(
                                    nodeById(edge.sourceNodeId)!,
                                    language,
                                  ).title}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                {edge.note[language]}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="detail-copy">{t.noImpacts}</p>
                      )}
                    </section>
                    <section>
                      <p className="detail-label">{t.linkedNodes}</p>
                      {connectedEdges.length ? (
                        <div className="space-y-2">
                          {connectedEdges.map((edge) => {
                            const incoming = edge.targetNodeId === selected.id;
                            const other = nodeById(
                              incoming ? edge.sourceNodeId : edge.targetNodeId,
                            );
                            return (
                              <button
                                key={edge.id}
                                className="flex w-full items-start gap-3 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
                                onClick={() => other && setSelectedId(other.id)}
                              >
                                <ArrowLeftRight className="mt-0.5 size-4 shrink-0 text-slate-400" />
                                <span>
                                  <span className="block text-xs font-bold uppercase text-slate-500">
                                    {incoming ? t.incoming : t.outgoing} ·{' '}
                                    {
                                      relationshipLabels[language][
                                        edge.relationshipType
                                      ]
                                    }
                                  </span>
                                  <span className="mt-1 block text-sm font-semibold text-slate-800">
                                    {other && nodeText(other, language).title}
                                  </span>
                                  {edge.note[language] && (
                                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                                      {edge.note[language]}
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="detail-copy">{t.noLinks}</p>
                      )}
                    </section>
                    <section>
                      <p className="detail-label">{t.timestamps}</p>
                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                        <div className="rounded-lg bg-slate-100 p-3">
                          <span className="block font-bold uppercase text-slate-500">
                            {t.created}
                          </span>
                          <span className="mt-1 block">
                            {formatDate(selected.createdAt, language)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-100 p-3">
                          <span className="block font-bold uppercase text-slate-500">
                            {t.updated}
                          </span>
                          <span className="mt-1 block">
                            {formatDate(selected.updatedAt, language)}
                          </span>
                        </div>
                      </div>
                    </section>
                  </div>
                </ScrollArea>
                <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-slate-50 p-4">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setEditingId(selected.id);
                      setNodeEditorOpen(true);
                    }}
                  >
                    {t.edit}
                  </Button>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => downloadJson(selected)}
                          aria-label={t.nodeJson}
                        >
                          <FileJson2 />
                        </Button>
                      }
                    />
                    <TooltipContent>{t.nodeJson}</TooltipContent>
                  </Tooltip>
                  {['decision', 'judgement'].includes(selected.type) && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={traceEvidence}
                            aria-label={t.trace}
                          >
                            <GitBranch />
                          </Button>
                        }
                      />
                      <TooltipContent>{t.trace}</TooltipContent>
                    </Tooltip>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setDeleteOpen(true)}
                    aria-label={t.delete}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
        <Sheet
          open={Boolean(selectedSpot)}
          onOpenChange={(open) => {
            if (!open) setSelectedSpotId(null);
          }}
        >
          <SheetContent className="w-full gap-0 p-0 sm:max-w-[470px]">
            {selectedSpot &&
              (() => {
                const spotStatus = evaluateLogic(selectedSpot, state.nodes);
                const palette = STATUS_STYLE[spotStatus];
                const inputs = selectedSpot.inputNodeIds
                  .map((id) => nodeById(id))
                  .filter(Boolean) as ResearchNode[];
                return (
                  <>
                    <SheetHeader className="border-b px-6 pb-5 pt-6">
                      <div
                        className="mb-3 grid size-16 place-items-center rounded-full border-4 bg-white font-serif text-3xl font-bold"
                        style={{
                          borderColor: palette.color,
                          color: palette.color,
                        }}
                      >
                        {logicSymbols[selectedSpot.logicType]}
                      </div>
                      <SheetTitle>{selectedSpot.label[language]}</SheetTitle>
                      <SheetDescription>
                        {logicSpotRules[language][selectedSpot.logicType]}
                      </SheetDescription>
                    </SheetHeader>
                    <ScrollArea className="min-h-0 flex-1">
                      <div className="space-y-6 p-6">
                        <section>
                          <p className="detail-label">{t.derivedStatus}</p>
                          <div
                            className="flex items-center gap-2 rounded-lg border p-3 text-sm font-bold"
                            style={{
                              color: palette.color,
                              background: palette.soft,
                              borderColor: `${palette.color}44`,
                            }}
                          >
                            <span
                              className="size-3 rounded-full"
                              style={{ background: palette.color }}
                            />
                            {statusLabels[language][spotStatus]} ·{' '}
                            {
                              inputs.filter(
                                (node) => node.status === 'confirmed',
                              ).length
                            }
                            /{inputs.length} {t.inputsPassing}
                          </div>
                        </section>
                        <section>
                          <p className="detail-label">{t.parentQuestion}</p>
                          <button
                            className="w-full rounded-lg border p-3 text-left text-sm font-semibold hover:bg-slate-50"
                            onClick={() => {
                              setSelectedId(selectedSpot.parentNodeId);
                              setSelectedSpotId(null);
                            }}
                          >
                            {nodeById(selectedSpot.parentNodeId) &&
                              nodeText(
                                nodeById(selectedSpot.parentNodeId)!,
                                language,
                              ).title}
                          </button>
                        </section>
                        <section>
                          <p className="detail-label">{t.independentInputs}</p>
                          <div className="space-y-2">
                            {inputs.map((node, index) => (
                              <button
                                key={node.id}
                                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-slate-50"
                                onClick={() => {
                                  setSelectedId(node.id);
                                  setSelectedSpotId(null);
                                }}
                              >
                                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold">
                                  {String.fromCharCode(97 + index)}
                                </span>
                                <span className="min-w-0 flex-1 text-sm font-semibold">
                                  {nodeText(node, language).title}
                                </span>
                                <span
                                  className="size-3 rounded-full"
                                  style={{
                                    background: STATUS_STYLE[node.status].color,
                                  }}
                                />
                              </button>
                            ))}
                          </div>
                        </section>
                      </div>
                    </ScrollArea>
                    <div className="border-t bg-slate-50 p-4">
                      <Button
                        variant="outline"
                        className="w-full text-red-600"
                        onClick={() => setDeleteOpen(true)}
                      >
                        <Trash2 />
                        {t.deleteSpot}
                      </Button>
                    </div>
                  </>
                );
              })()}
          </SheetContent>
        </Sheet>
        {nodeEditorOpen && (
          <NodeEditor
            open={nodeEditorOpen}
            onOpenChange={setNodeEditorOpen}
            language={language}
            initial={
              editingId && selected
                ? {
                    type: selected.type,
                    status: selected.status,
                    content: selected.content,
                  }
                : blankDraft()
            }
            onSave={saveNode}
          />
        )}
        {projectEditorOpen && (
          <ProjectEditor
            open={projectEditorOpen}
            onOpenChange={setProjectEditorOpen}
            language={language}
            onSave={createTree}
          />
        )}
        {relationshipOpen && (
          <RelationshipEditor
            open={relationshipOpen}
            onOpenChange={setRelationshipOpen}
            language={language}
            nodes={state.nodes}
            initialSource={selectedId ?? ''}
            onSave={saveRelationship}
          />
        )}
        {logicOpen && (
          <LogicSpotEditor
            open={logicOpen}
            onOpenChange={setLogicOpen}
            language={language}
            nodes={state.nodes}
            existingParentIds={state.logicSpots.map(
              (spot) => spot.parentNodeId,
            )}
            initialParent={selectedId ?? ''}
            onSave={saveLogicSpot}
          />
        )}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {selectedSpot ? t.deleteSpotTitle : t.deleteTitle}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {selectedSpot ? t.deleteSpotWarning : t.deleteWarning}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={deleteSelection}
              >
                {selectedSpot ? t.deleteSpot : t.confirmDelete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.resetTitle}</AlertDialogTitle>
              <AlertDialogDescription>{t.resetWarning}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  updateState(() =>
                    applyLogicStatuses(researchTreeRepository.reset()),
                  );
                  setSelectedId(null);
                  setSelectedSpotId(null);
                  setTraceIds(null);
                  setResetOpen(false);
                }}
              >
                {t.reset}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={removeTreeOpen} onOpenChange={setRemoveTreeOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.removeTreeTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.removeTreeWarning}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={removeActiveTree}
              >
                {t.removeTree}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </TooltipProvider>
  );
}
