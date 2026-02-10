import type {
  StudentProfile,
  SupervisorProfile,
  AdminProfile,
  Project,
  Milestone,
  SupervisionRequest,
  SupervisorMatch,
  SystemHealth,
  SystemStats,
} from "@/types"

// Mock Students
export const mockStudents: StudentProfile[] = [
  {
    id: "stu-001",
    email: "john.smith@university.ac.uk",
    name: "John Smith",
    role: "student",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=john",
    createdAt: "2024-09-01",
    degree: "MSc Computer Science",
    department: "School of Computing",
    yearOfStudy: 2,
    skills: ["Python", "Machine Learning", "Data Analysis", "TensorFlow"],
    researchInterests: ["Natural Language Processing", "Deep Learning", "AI Ethics"],
    availability: "full-time",
    supervisorId: "sup-001",
    projectId: "proj-001",
  },
  {
    id: "stu-002",
    email: "sarah.jones@university.ac.uk",
    name: "Sarah Jones",
    role: "student",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
    createdAt: "2024-09-01",
    degree: "MSc Data Science",
    department: "School of Computing",
    yearOfStudy: 1,
    skills: ["R", "Statistical Analysis", "SQL", "Tableau"],
    researchInterests: ["Healthcare Analytics", "Predictive Modeling"],
    availability: "full-time",
    supervisorId: "sup-002",
    projectId: "proj-002",
  },
  {
    id: "stu-003",
    email: "michael.chen@university.ac.uk",
    name: "Michael Chen",
    role: "student",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=michael",
    createdAt: "2024-09-15",
    degree: "BSc Software Engineering",
    department: "School of Computing",
    yearOfStudy: 3,
    skills: ["Java", "React", "Node.js", "AWS"],
    researchInterests: ["Cloud Computing", "Microservices", "DevOps"],
    availability: "part-time",
  },
  {
    id: "stu-004",
    email: "emma.wilson@university.ac.uk",
    name: "Emma Wilson",
    role: "student",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=emma",
    createdAt: "2024-09-10",
    degree: "MSc Artificial Intelligence",
    department: "School of Computing",
    yearOfStudy: 1,
    skills: ["Python", "PyTorch", "Computer Vision", "OpenCV"],
    researchInterests: ["Computer Vision", "Autonomous Systems", "Robotics"],
    availability: "full-time",
  },
  {
    id: "stu-005",
    email: "david.brown@university.ac.uk",
    name: "David Brown",
    role: "student",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=david",
    createdAt: "2024-09-05",
    degree: "MSc Cybersecurity",
    department: "School of Computing",
    yearOfStudy: 2,
    skills: ["Network Security", "Penetration Testing", "Cryptography"],
    researchInterests: ["Blockchain Security", "Zero Trust Architecture"],
    availability: "full-time",
    supervisorId: "sup-003",
    projectId: "proj-003",
  },
]

// Mock Supervisors
export const mockSupervisors: SupervisorProfile[] = [
  {
    id: "sup-001",
    email: "dr.williams@university.ac.uk",
    name: "Dr. Emily Williams",
    role: "supervisor",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=emily",
    createdAt: "2020-01-15",
    department: "School of Computing",
    expertise: ["Machine Learning", "Natural Language Processing", "Deep Learning"],
    researchAreas: ["AI in Healthcare", "Sentiment Analysis", "Language Models"],
    maxStudents: 5,
    currentStudents: 3,
    pastProjects: [
      "Sentiment Analysis in Social Media",
      "Medical Diagnosis using NLP",
      "Chatbot Development with Transformers",
    ],
    bio: "Professor of Machine Learning with 15 years of experience in NLP and deep learning research.",
  },
  {
    id: "sup-002",
    email: "dr.taylor@university.ac.uk",
    name: "Dr. James Taylor",
    role: "supervisor",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=james",
    createdAt: "2018-09-01",
    department: "School of Computing",
    expertise: ["Data Analytics", "Healthcare Informatics", "Statistical Modeling"],
    researchAreas: ["Predictive Healthcare", "Clinical Decision Support", "Epidemiology"],
    maxStudents: 4,
    currentStudents: 2,
    pastProjects: [
      "Predicting Hospital Readmissions",
      "COVID-19 Spread Modeling",
      "Patient Risk Stratification",
    ],
    bio: "Associate Professor specializing in healthcare data analytics and clinical informatics.",
  },
  {
    id: "sup-003",
    email: "dr.martinez@university.ac.uk",
    name: "Dr. Sofia Martinez",
    role: "supervisor",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=sofia",
    createdAt: "2019-03-20",
    department: "School of Computing",
    expertise: ["Cybersecurity", "Blockchain", "Distributed Systems"],
    researchAreas: ["Zero Trust Networks", "Smart Contract Security", "IoT Security"],
    maxStudents: 6,
    currentStudents: 4,
    pastProjects: [
      "Blockchain-based Voting Systems",
      "IoT Security Framework",
      "Zero Trust Implementation Guide",
    ],
    bio: "Senior Lecturer in Cybersecurity with industry experience at major tech companies.",
  },
  {
    id: "sup-004",
    email: "dr.anderson@university.ac.uk",
    name: "Dr. Robert Anderson",
    role: "supervisor",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=robert",
    createdAt: "2017-06-10",
    department: "School of Computing",
    expertise: ["Cloud Computing", "Distributed Systems", "Software Architecture"],
    researchAreas: ["Microservices", "Serverless Computing", "Container Orchestration"],
    maxStudents: 5,
    currentStudents: 5,
    pastProjects: [
      "Kubernetes Auto-scaling Strategies",
      "Serverless Cost Optimization",
      "Multi-cloud Deployment Patterns",
    ],
    bio: "Professor of Software Engineering focusing on cloud-native architectures.",
  },
  {
    id: "sup-005",
    email: "dr.patel@university.ac.uk",
    name: "Dr. Priya Patel",
    role: "supervisor",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=priya",
    createdAt: "2021-01-05",
    department: "School of Computing",
    expertise: ["Computer Vision", "Robotics", "Autonomous Systems"],
    researchAreas: ["Self-driving Vehicles", "Object Detection", "SLAM"],
    maxStudents: 4,
    currentStudents: 1,
    pastProjects: [
      "Real-time Object Detection for Drones",
      "Indoor Navigation Robot",
      "Visual SLAM Implementation",
    ],
    bio: "Lecturer in AI and Robotics with a focus on perception systems.",
  },
]

// Mock Admin
export const mockAdmin: AdminProfile = {
  id: "admin-001",
  email: "admin@university.ac.uk",
  name: "System Administrator",
  role: "admin",
  avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
  createdAt: "2020-01-01",
  permissions: ["manage_users", "manage_roles", "view_logs", "system_config"],
}

// Mock Projects
export const mockProjects: Project[] = [
  {
    id: "proj-001",
    studentId: "stu-001",
    title: "AI-Powered Academic Writing Assistant",
    abstract:
      "Developing an intelligent writing assistant that helps students improve their academic writing through NLP-based feedback and suggestions.",
    description:
      "This project aims to create a web-based tool that analyzes academic text and provides real-time feedback on structure, clarity, and academic tone. Using transformer models, the system will offer contextual suggestions to improve writing quality.",
    keywords: ["NLP", "Academic Writing", "AI Assistant", "Transformers"],
    expertiseTags: ["Natural Language Processing", "Deep Learning", "Text Analysis"],
    status: "active",
    createdAt: "2024-10-01",
    updatedAt: "2024-12-15",
  },
  {
    id: "proj-002",
    studentId: "stu-002",
    title: "Predictive Analytics for Student Success",
    abstract:
      "Building a predictive model to identify at-risk students early in their academic journey using historical data and machine learning.",
    description:
      "This research develops machine learning models to predict student academic outcomes based on engagement metrics, assessment scores, and demographic factors. The goal is to enable early intervention strategies.",
    keywords: ["Education Analytics", "Predictive Modeling", "Machine Learning"],
    expertiseTags: ["Data Analytics", "Statistical Modeling", "Healthcare Informatics"],
    status: "active",
    createdAt: "2024-10-15",
    updatedAt: "2024-12-10",
  },
  {
    id: "proj-003",
    studentId: "stu-005",
    title: "Decentralized Identity Management System",
    abstract:
      "Implementing a blockchain-based identity management solution for secure and privacy-preserving user authentication.",
    description:
      "This project explores the use of decentralized identifiers (DIDs) and verifiable credentials on a blockchain network to create a self-sovereign identity system that gives users control over their personal data.",
    keywords: ["Blockchain", "Identity Management", "Privacy", "Security"],
    expertiseTags: ["Cybersecurity", "Blockchain", "Distributed Systems"],
    status: "active",
    createdAt: "2024-09-20",
    updatedAt: "2024-12-18",
  },
]

// Mock Milestones for Project 1
export const mockMilestones: Milestone[] = [
  {
    id: "mile-001",
    projectId: "proj-001",
    title: "Project Proposal Submission (PPRS)",
    description: "Submit detailed project proposal with literature review and methodology",
    dueDate: "2024-11-15",
    completedDate: "2024-11-14",
    status: "completed",
    isCriticalPath: true,
  },
  {
    id: "mile-002",
    projectId: "proj-001",
    title: "Literature Review",
    description: "Complete comprehensive review of existing NLP writing tools and research",
    dueDate: "2024-12-01",
    completedDate: "2024-11-30",
    status: "completed",
    isCriticalPath: false,
  },
  {
    id: "mile-003",
    projectId: "proj-001",
    title: "Data Collection & Preprocessing",
    description: "Gather academic writing samples and prepare training dataset",
    dueDate: "2025-01-15",
    status: "in_progress",
    isCriticalPath: false,
  },
  {
    id: "mile-004",
    projectId: "proj-001",
    title: "Model Development",
    description: "Develop and train the NLP model for text analysis",
    dueDate: "2025-02-28",
    status: "pending",
    isCriticalPath: false,
  },
  {
    id: "mile-005",
    projectId: "proj-001",
    title: "Interim Project Demonstration (IPD)",
    description: "Present working prototype and preliminary results",
    dueDate: "2025-03-15",
    status: "pending",
    isCriticalPath: true,
  },
  {
    id: "mile-006",
    projectId: "proj-001",
    title: "User Testing & Evaluation",
    description: "Conduct user studies and gather feedback",
    dueDate: "2025-04-30",
    status: "pending",
    isCriticalPath: false,
  },
  {
    id: "mile-007",
    projectId: "proj-001",
    title: "Final Report Submission",
    description: "Submit complete dissertation document",
    dueDate: "2025-05-15",
    status: "pending",
    isCriticalPath: true,
  },
  {
    id: "mile-008",
    projectId: "proj-001",
    title: "Final Viva",
    description: "Oral examination and project defense",
    dueDate: "2025-06-01",
    status: "pending",
    isCriticalPath: true,
  },
]

// Mock Supervision Requests
export const mockSupervisionRequests: SupervisionRequest[] = [
  {
    id: "req-001",
    studentId: "stu-003",
    supervisorId: "sup-004",
    projectId: "proj-temp-001",
    status: "pending",
    matchScore: 92,
    matchReasons: [
      "Strong alignment in Cloud Computing expertise",
      "Previous projects in microservices architecture",
      "Available capacity for new students",
    ],
    createdAt: "2024-12-10",
  },
  {
    id: "req-002",
    studentId: "stu-004",
    supervisorId: "sup-005",
    projectId: "proj-temp-002",
    status: "pending",
    matchScore: 88,
    matchReasons: [
      "Shared interest in Computer Vision",
      "Experience with autonomous systems",
      "Complementary research focus",
    ],
    createdAt: "2024-12-12",
  },
]

// Mock Supervisor Matches for a student
export const mockSupervisorMatches: SupervisorMatch[] = [
  {
    supervisor: mockSupervisors[0],
    matchScore: 95,
    matchReasons: [
      "Expertise in NLP matches your project focus",
      "Previous projects in AI writing tools",
      "Strong track record with MSc students",
    ],
    similarProjects: ["Chatbot Development with Transformers", "Medical Diagnosis using NLP"],
  },
  {
    supervisor: mockSupervisors[1],
    matchScore: 72,
    matchReasons: [
      "Experience in data-driven applications",
      "Available capacity for new students",
    ],
    similarProjects: ["Predicting Hospital Readmissions"],
  },
  {
    supervisor: mockSupervisors[4],
    matchScore: 65,
    matchReasons: [
      "AI expertise applicable to your domain",
      "Research in intelligent systems",
    ],
    similarProjects: ["Real-time Object Detection for Drones"],
  },
]

// Mock System Health
export const mockSystemHealth: SystemHealth[] = [
  {
    service: "Authentication Service",
    status: "operational",
    lastChecked: "2024-12-20T10:30:00Z",
    uptime: 99.99,
  },
  {
    service: "Database (PostgreSQL)",
    status: "operational",
    lastChecked: "2024-12-20T10:30:00Z",
    uptime: 99.95,
  },
  {
    service: "AI Matching Engine",
    status: "operational",
    lastChecked: "2024-12-20T10:30:00Z",
    uptime: 99.87,
  },
  {
    service: "Notification Service",
    status: "degraded",
    lastChecked: "2024-12-20T10:30:00Z",
    uptime: 98.50,
  },
  {
    service: "File Storage",
    status: "operational",
    lastChecked: "2024-12-20T10:30:00Z",
    uptime: 99.99,
  },
]

// Mock System Stats
export const mockSystemStats: SystemStats = {
  totalStudents: 156,
  totalSupervisors: 24,
  activeProjects: 89,
  pendingRequests: 12,
  completedProjects: 234,
  averageMatchScore: 87.5,
}

// Current logged-in user (for demo purposes)
export const currentStudent = mockStudents[0]
export const currentSupervisor = mockSupervisors[0]
export const currentAdmin = mockAdmin

// Helper to get students by supervisor
export function getStudentsBySupervisor(supervisorId: string): StudentProfile[] {
  return mockStudents.filter((s) => s.supervisorId === supervisorId)
}

// Helper to get pending requests for supervisor
export function getPendingRequestsForSupervisor(supervisorId: string): SupervisionRequest[] {
  return mockSupervisionRequests.filter(
    (r) => r.supervisorId === supervisorId && r.status === "pending"
  )
}

// Expertise tags (standardized university list)
export const expertiseTags = [
  "Machine Learning",
  "Deep Learning",
  "Natural Language Processing",
  "Computer Vision",
  "Data Analytics",
  "Cybersecurity",
  "Blockchain",
  "Cloud Computing",
  "Distributed Systems",
  "Software Engineering",
  "Human-Computer Interaction",
  "Robotics",
  "IoT",
  "Mobile Development",
  "Web Development",
  "Database Systems",
  "Algorithms",
  "Artificial Intelligence",
  "Healthcare Informatics",
  "Game Development",
]
