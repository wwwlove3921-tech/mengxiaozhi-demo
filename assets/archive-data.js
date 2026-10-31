// Exact element headings from AQ/T 3034—2022, §4.1–4.20. Counts are synthetic.
const archiveElements = [
  {
    "name": "安全领导力",
    "clause": "4.1",
    "desc": "方针目标、领导承诺、履职与资源保障",
    "count": 6,
    "total": 6,
    "color": "",
    "pct": 100
  },
  {
    "name": "安全生产责任制",
    "clause": "4.2",
    "desc": "组织架构、岗位责任、考核与履职记录",
    "count": 10,
    "total": 11,
    "color": "blue",
    "pct": 91
  },
  {
    "name": "安全生产合规性管理",
    "clause": "4.3",
    "desc": "适用要求、合规评价、监管文件与整改",
    "count": 7,
    "total": 8,
    "color": "amber",
    "pct": 88
  },
  {
    "name": "安全生产信息管理",
    "clause": "4.4",
    "desc": "化学品、工艺与设备信息、版本管理",
    "count": 10,
    "total": 12,
    "color": "purple",
    "pct": 83
  },
  {
    "name": "安全教育、培训和能力建设",
    "clause": "4.5",
    "desc": "培训需求、计划、实施、考核与能力评价",
    "count": 12,
    "total": 15,
    "color": "",
    "pct": 80
  },
  {
    "name": "风险管理",
    "clause": "4.6",
    "desc": "风险辨识评价、管控措施与隐患治理",
    "count": 11,
    "total": 14,
    "color": "blue",
    "pct": 79
  },
  {
    "name": "装置安全规划与设计",
    "clause": "4.7",
    "desc": "选址总图、安全设计、审查与建设资料",
    "count": 6,
    "total": 6,
    "color": "amber",
    "pct": 100
  },
  {
    "name": "装置首次开车安全",
    "clause": "4.8",
    "desc": "开车方案、安全审查、条件确认与记录",
    "count": 4,
    "total": 4,
    "color": "purple",
    "pct": 100
  },
  {
    "name": "安全操作",
    "clause": "4.9",
    "desc": "操作规程、工艺卡片、交接班与异常处置",
    "count": 9,
    "total": 11,
    "color": "",
    "pct": 82
  },
  {
    "name": "设备完好性管理",
    "clause": "4.10",
    "desc": "设备台账、检验检测、维护与可靠性",
    "count": 10,
    "total": 12,
    "color": "blue",
    "pct": 83
  },
  {
    "name": "安全仪表管理",
    "clause": "4.11",
    "desc": "安全仪表台账、功能评估、测试与联锁",
    "count": 5,
    "total": 6,
    "color": "amber",
    "pct": 83
  },
  {
    "name": "重大危险源安全管理",
    "clause": "4.12",
    "desc": "辨识分级、监测监控、包保与应急资料",
    "count": 5,
    "total": 7,
    "color": "purple",
    "pct": 71
  },
  {
    "name": "作业许可",
    "clause": "4.13",
    "desc": "特殊作业、风险分析、作业票与监护记录",
    "count": 6,
    "total": 7,
    "color": "",
    "pct": 86
  },
  {
    "name": "承包商安全管理",
    "clause": "4.14",
    "desc": "承包商评价、人员培训、作业与绩效",
    "count": 5,
    "total": 6,
    "color": "blue",
    "pct": 83
  },
  {
    "name": "变更管理",
    "clause": "4.15",
    "desc": "变更申请、风险评估、实施、验收与关闭",
    "count": 5,
    "total": 7,
    "color": "amber",
    "pct": 71
  },
  {
    "name": "应急准备与响应",
    "clause": "4.16",
    "desc": "应急资源、预案、演练、评估与改进",
    "count": 6,
    "total": 7,
    "color": "purple",
    "pct": 86
  },
  {
    "name": "事故事件管理",
    "clause": "4.17",
    "desc": "事故事件报告、调查分析、整改与分享",
    "count": 3,
    "total": 3,
    "color": "",
    "pct": 100
  },
  {
    "name": "本质更安全",
    "clause": "4.18",
    "desc": "工艺技术评估、风险消减与改进方案",
    "count": 2,
    "total": 3,
    "color": "blue",
    "pct": 67
  },
  {
    "name": "安全文化建设",
    "clause": "4.19",
    "desc": "文化活动、安全沟通、建议与行为观察",
    "count": 3,
    "total": 3,
    "color": "amber",
    "pct": 100
  },
  {
    "name": "体系审核与持续改进",
    "clause": "4.20",
    "desc": "体系审核、问题整改、管理评审与改进",
    "count": 3,
    "total": 4,
    "color": "purple",
    "pct": 75
  }
];
