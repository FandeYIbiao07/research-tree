import type {
  Language,
  LocalizedNodeContent,
  NodeStatus,
  NodeType,
  ResearchNode,
  ResearchProjectState,
} from './types';

const content = (
  en: Omit<LocalizedNodeContent, 'assumptions'> & { assumptions?: string[] },
  zh: Omit<LocalizedNodeContent, 'assumptions'> & { assumptions?: string[] },
): Record<Language, LocalizedNodeContent> => ({
  en: { ...en, assumptions: en.assumptions ?? [] },
  zh: { ...zh, assumptions: zh.assumptions ?? [] },
});

const node = (
  id: string,
  type: NodeType,
  status: NodeStatus,
  body: ResearchNode['content'],
  createdAt: string,
  updatedAt = createdAt,
): ResearchNode => ({
  languageType: 'en-zh',
  id,
  type,
  status,
  content: body,
  createdAt,
  updatedAt,
  end: 'end',
});

export const sampleProject: ResearchProjectState = {
  schemaVersion: 2,
  project: {
    id: 'weekend-library-pilot',
    title: { en: 'Weekend Library Access', zh: '周末图书馆开放' },
    researchQuestion: {
      en: 'Should the community library test longer weekend opening hours?',
      zh: '社区图书馆是否应试行延长周末开放时间？',
    },
  },
  nodes: [
    node('q-main', 'openQuestion', 'tentative', content(
      {
        title: 'A. Should weekend hours be extended?',
        summary: 'The proposal is evaluated through three independent questions.',
        notes: 'The logic spot records the acceptance rule explicitly.',
        source: 'Illustrative research brief',
        assumptions: ['Each sub-question can be evaluated independently.'],
      },
      {
        title: 'A. 是否应延长周末开放时间？',
        summary: '该提案通过三个彼此独立的问题进行评估。',
        notes: '逻辑 spot 明确记录了通过规则。',
        source: '示例研究简报',
        assumptions: ['每个子问题均可独立评估。'],
      },
    ), '2026-01-05T09:00:00.000Z'),
    node('q-demand', 'openQuestion', 'confirmed', content(
      {
        title: 'a. Is unmet weekend demand substantial?',
        summary: 'Entry counts and wait-list records indicate recurring unmet demand.',
        notes: 'This question is supported by direct observational evidence.',
        source: 'Illustrative visitor-count dataset',
      },
      {
        title: 'a. 周末未满足需求是否显著？',
        summary: '入馆人数与候补记录表明未满足需求反复出现。',
        notes: '该问题由直接观察证据支持。',
        source: '示例访客统计数据',
      },
    ), '2026-01-06T10:00:00.000Z'),
    node('q-cost', 'openQuestion', 'tentative', content(
      {
        title: 'b. Can staffing remain within budget?',
        summary: 'A staggered rota may control cost, but the estimate is not final.',
        notes: 'Verify overtime and security coverage before confirmation.',
        source: 'Illustrative staffing estimate',
      },
      {
        title: 'b. 人员成本能否控制在预算内？',
        summary: '错峰排班可能控制成本，但估算尚未最终确认。',
        notes: '确认前需核实加班与安保覆盖成本。',
        source: '示例人员成本估算',
      },
    ), '2026-01-07T10:00:00.000Z'),
    node('q-equity', 'openQuestion', 'needsVerification', content(
      {
        title: 'c. Would longer hours improve access equity?',
        summary: 'The expected benefit is plausible but requires user-group evidence.',
        notes: 'Interview shift workers, carers, and students.',
        source: 'Open research question',
      },
      {
        title: 'c. 延长开放是否会改善公平使用？',
        summary: '预期收益具有合理性，但仍需用户群体证据。',
        notes: '需要访谈轮班工作者、照护者和学生。',
        source: '待研究问题',
      },
    ), '2026-01-08T10:00:00.000Z'),
    node('e-counts', 'evidence', 'confirmed', content(
      {
        title: 'Weekend capacity is repeatedly reached',
        summary: 'Four consecutive weekends show peak-hour entries at the stated capacity.',
        notes: 'This is evidence of demand, not proof that every additional hour will be used.',
        source: 'Illustrative entrance counts, weeks 1–4',
        assumptions: ['The counting method is consistent across weekends.'],
      },
      {
        title: '周末容量反复达到上限',
        summary: '连续四个周末的高峰时段入馆人数均达到既定容量。',
        notes: '这能证明需求存在，但不能证明每个新增时段都会被使用。',
        source: '示例入馆统计，第1至4周',
        assumptions: ['各周末采用一致的统计方法。'],
      },
    ), '2026-01-06T09:30:00.000Z'),
    node('a-signups', 'assumption', 'needsVerification', content(
      {
        title: 'Sign-ups predict sustained attendance',
        summary: 'The initial plan treats expressions of interest as future visits.',
        notes: 'This assumption should be tested during a time-limited pilot.',
        source: 'Illustrative planning memo',
        assumptions: ['Survey intentions translate into actual behaviour.'],
      },
      {
        title: '报名意向能够预测持续到访',
        summary: '初步计划把兴趣登记视为未来到访。',
        notes: '应在限时试点中检验这一假设。',
        source: '示例规划备忘录',
        assumptions: ['调查意向能够转化为实际行为。'],
      },
    ), '2026-01-06T13:00:00.000Z'),
    node('h-rota', 'hypothesis', 'tentative', content(
      {
        title: 'A staggered rota can contain cost',
        summary: 'Shifting existing coverage may fund two extra weekend hours.',
        notes: 'Test the rota without reducing weekday service quality.',
        source: 'Illustrative operations model',
      },
      {
        title: '错峰排班可以控制成本',
        summary: '调整现有覆盖时段可能支持周末增加两小时。',
        notes: '测试排班时不得降低工作日服务质量。',
        source: '示例运营模型',
      },
    ), '2026-01-07T13:00:00.000Z'),
    node('j-old', 'judgement', 'supersededReopened', content(
      {
        title: 'High demand justifies permanent expansion',
        summary: 'The first judgement moved directly from observed demand to permanent change.',
        notes: 'Superseded because cost and attendance persistence remain uncertain.',
        source: 'Illustrative judgement v1',
      },
      {
        title: '高需求足以支持永久延长',
        summary: '最初判断从观察到的需求直接推导出永久调整。',
        notes: '由于成本与持续到访仍不确定，该判断已被取代。',
        source: '示例判断 v1',
      },
    ), '2026-01-08T14:00:00.000Z', '2026-01-10T11:00:00.000Z'),
    node('j-pilot', 'judgement', 'tentative', content(
      {
        title: 'A pilot is preferable to a permanent change',
        summary: 'A limited trial can test attendance, cost, and equity before commitment.',
        notes: 'This judgement preserves the earlier reasoning while narrowing the claim.',
        source: 'Illustrative judgement v2',
      },
      {
        title: '试点优于永久调整',
        summary: '限时试行可在正式承诺前检验到访、成本与公平性。',
        notes: '该判断保留早期推理，同时缩小了主张范围。',
        source: '示例判断 v2',
      },
    ), '2026-01-10T11:00:00.000Z'),
    node('d-pilot', 'decision', 'confirmed', content(
      {
        title: 'Run an eight-week weekend pilot',
        summary: 'Extend opening by two hours and review predefined measures after eight weeks.',
        notes: 'Trace this decision backward through the revised judgement and its evidence.',
        source: 'Illustrative decision record',
      },
      {
        title: '开展八周周末试点',
        summary: '周末延长开放两小时，并在八周后复核预设指标。',
        notes: '可以从该决策反向追踪至修订判断及其证据。',
        source: '示例决策记录',
      },
    ), '2026-01-11T09:00:00.000Z'),
    node('r-rollout', 'rejectedBranch', 'rejected', content(
      {
        title: 'Extend hours permanently without a pilot',
        summary: 'Immediate permanent rollout would hide uncertainty about cost and sustained use.',
        notes: 'The branch remains visible so the rejected option and rationale are not lost.',
        source: 'Illustrative option review',
      },
      {
        title: '不经试点直接永久延长',
        summary: '立即永久推行会掩盖成本与持续使用方面的不确定性。',
        notes: '保留该分支，以免丢失被否决的选项及理由。',
        source: '示例方案评审',
      },
    ), '2026-01-10T11:05:00.000Z'),
  ],
  edges: [
    { id: 'edge-counts-demand', sourceNodeId: 'e-counts', targetNodeId: 'q-demand', relationshipType: 'supports', note: { en: 'Observed crowding supports the demand finding.', zh: '观察到的拥挤支持需求判断。' }, createdAt: '2026-01-06T10:10:00.000Z' },
    { id: 'edge-demand-old', sourceNodeId: 'q-demand', targetNodeId: 'j-old', relationshipType: 'supports', note: { en: 'Confirmed demand made the original judgement plausible.', zh: '已确认的需求使原判断具有合理性。' }, createdAt: '2026-01-08T14:00:00.000Z' },
    { id: 'edge-cost-old', sourceNodeId: 'q-cost', targetNodeId: 'j-old', relationshipType: 'contradicts', note: { en: 'Unresolved cost weakens a permanent commitment.', zh: '尚未解决的成本问题削弱了永久承诺。' }, createdAt: '2026-01-10T10:30:00.000Z' },
    { id: 'edge-rota-cost', sourceNodeId: 'h-rota', targetNodeId: 'q-cost', relationshipType: 'supports', note: { en: 'The rota hypothesis offers a testable cost mechanism.', zh: '排班假设提供了可检验的成本机制。' }, createdAt: '2026-01-07T13:15:00.000Z' },
    { id: 'edge-pilot-old', sourceNodeId: 'j-pilot', targetNodeId: 'j-old', relationshipType: 'replaces', note: { en: 'The revised judgement keeps the old judgement as history.', zh: '修订判断保留旧判断作为历史。' }, createdAt: '2026-01-10T11:00:00.000Z' },
    { id: 'edge-assumption-pilot', sourceNodeId: 'a-signups', targetNodeId: 'j-pilot', relationshipType: 'modifies', note: { en: 'The pilot converts an unverified assumption into a measurable question.', zh: '试点把未经验证的假设转化为可测量问题。' }, createdAt: '2026-01-10T11:10:00.000Z' },
    { id: 'edge-judgement-decision', sourceNodeId: 'j-pilot', targetNodeId: 'd-pilot', relationshipType: 'supports', note: { en: 'The revised judgement supports a reversible decision.', zh: '修订判断支持一项可逆决策。' }, createdAt: '2026-01-11T09:00:00.000Z' },
    { id: 'edge-rejected-decision', sourceNodeId: 'r-rollout', targetNodeId: 'd-pilot', relationshipType: 'modifies', note: { en: 'Rejecting permanent rollout defines the pilot boundary.', zh: '否决永久推行明确了试点边界。' }, createdAt: '2026-01-11T09:05:00.000Z' },
  ],
  logicSpots: [
    {
      languageType: 'en-zh',
      id: 'spot-main-any',
      label: { en: 'A verification', zh: 'A 的验证' },
      logicType: 'any',
      threshold: null,
      parentNodeId: 'q-main',
      inputNodeIds: ['q-demand', 'q-cost', 'q-equity'],
      createdAt: '2026-01-08T12:00:00.000Z',
      updatedAt: '2026-01-08T12:00:00.000Z',
      end: 'end',
    },
  ],
  positions: {
    'q-main': { x: 20, y: 260 },
    'spot-main-any': { x: 330, y: 305 },
    'q-demand': { x: 540, y: 60 },
    'q-cost': { x: 540, y: 290 },
    'q-equity': { x: 540, y: 520 },
    'e-counts': { x: 900, y: 20 },
    'a-signups': { x: 900, y: 250 },
    'h-rota': { x: 900, y: 480 },
    'j-old': { x: 1220, y: 80 },
    'j-pilot': { x: 1220, y: 330 },
    'd-pilot': { x: 1530, y: 300 },
    'r-rollout': { x: 1220, y: 600 },
  },
  collapsedNodeIds: [],
  decisionLog: [
    { id: 'log-1', nodeId: 'j-old', action: 'created', summary: { en: 'Initial judgement proposed permanent expansion.', zh: '初始判断建议永久延长开放。' }, timestamp: '2026-01-08T14:00:00.000Z' },
    { id: 'log-2', nodeId: 'q-cost', action: 'impact', summary: { en: 'Unresolved cost caused the original judgement to require review.', zh: '尚未解决的成本使原判断需要复核。' }, timestamp: '2026-01-10T10:30:00.000Z' },
    { id: 'log-3', nodeId: 'j-old', action: 'statusChanged', summary: { en: 'The old judgement was marked superseded instead of deleted.', zh: '旧判断被标记为已取代，而非删除。' }, timestamp: '2026-01-10T11:00:00.000Z' },
    { id: 'log-4', nodeId: 'j-pilot', action: 'created', summary: { en: 'A time-limited pilot replaced the permanent-change judgement.', zh: '限时试点取代了永久调整判断。' }, timestamp: '2026-01-10T11:00:00.000Z' },
    { id: 'log-5', nodeId: 'd-pilot', action: 'created', summary: { en: 'Decision recorded: run an eight-week pilot.', zh: '已记录决策：开展八周试点。' }, timestamp: '2026-01-11T09:00:00.000Z' },
  ],
};
