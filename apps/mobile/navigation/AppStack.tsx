import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TopBanner from "../components/TopBanner";
import TimelineScreen from "../screens/TimelineScreen";
import FamilyDetailScreen from "../screens/FamilyDetailScreen";
import FamilyTimelineScreen from "../screens/FamilyTimelineScreen";
import UploadScreen from "../screens/UploadScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AdminScreen from "../screens/AdminScreen";
import RecordViewerScreen from "../screens/RecordViewerScreen";
import type { AppStackParamList } from "./types";

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppStack() {
  return (
    <Stack.Navigator
      initialRouteName="Timeline"
      screenOptions={{ header: (props) => <TopBanner {...props} /> }}
    >
      <Stack.Screen name="Timeline" component={TimelineScreen} />
      <Stack.Screen name="FamilyDetail" component={FamilyDetailScreen} />
      <Stack.Screen name="FamilyTimeline" component={FamilyTimelineScreen} />
      <Stack.Screen name="Upload" component={UploadScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Admin" component={AdminScreen} />
      <Stack.Screen name="RecordViewer" component={RecordViewerScreen} />
    </Stack.Navigator>
  );
}
