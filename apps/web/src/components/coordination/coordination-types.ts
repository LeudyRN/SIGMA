export interface TeacherProfile {
  specialties: string;
  availability: string;
  maxGroups: number;
  maxStudents: number;
  available: boolean;
}
export interface Teacher {
  id: string;
  name: string;
  canEdit: boolean;
  groups: number;
  students: number;
  profile: TeacherProfile | null;
}
export interface Milestone {
  id: string;
  projectId: string | null;
  title: string;
  type: string;
  dueAt: string;
  instructions: string;
  status: string;
  version: number;
}
export interface Submission {
  id: string;
  projectId: string;
  milestoneId: string;
  filename: string;
  createdAt: string;
  status: string;
  feedback: string | null;
  reviewedAt: string | null;
}
export interface Project {
  id: string;
  title: string;
  code: string;
  status: string;
  area: string;
  students: { name: string; registration: string }[];
  canSubmit: boolean;
  canReview: boolean;
  teachers: {
    id: string;
    name: string;
    role: string;
    typeId?: string;
    rationale: string | null;
    complexity: string | null;
  }[];
  progress: {
    total: number;
    approved: number;
    percent: number | null;
    awaitingReview: number;
    overdue: number;
    changes: number;
    oldestReviewDays: number;
    averageResponseHours: number | null;
  };
}
export interface TeacherRequest {
  id: string;
  teacherId: string;
  teacher: string;
  title: string;
  purpose: string;
  instructions: string;
  status: string;
  reference: string | null;
  canUpload: boolean;
  files: {
    id: string;
    filename: string;
    createdAt: string;
    status: string;
    feedback: string | null;
  }[];
}
export interface CoordinationData {
  offers: { id: string; title: string; teachingMode: string }[];
  ownTeacherId: string | null;
  course: {
    id: string;
    title: string;
    schoolId: string;
    canPlan: boolean;
    canDesignate: boolean;
    canManageDocuments: boolean;
    designation: {
      teacherId: string;
      teacher: string;
      school: string;
      date: string;
      reference: string;
    } | null;
  } | null;
  projects?: Project[];
  milestones?: Milestone[];
  submissions?: Submission[];
  teachers?: Teacher[];
  requests?: TeacherRequest[];
  generatedAt?: string;
}
