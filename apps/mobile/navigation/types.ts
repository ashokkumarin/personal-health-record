export type AppStackParamList = {
  Timeline: undefined;
  FamilyDetail: { familyId: string };
  FamilyTimeline: { familyId: string; patientId?: string };
  Upload: { familyId: string; patientId?: string };
  Settings: undefined;
  Profile: undefined;
  Admin: undefined;
  RecordViewer: { recordIds: string[]; index: number };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type DrawerParamList = {
  Main: undefined;
};
