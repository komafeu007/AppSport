import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type MainTabParamList = {
  Main: undefined;
  Seance: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  SessionEditor: { programId?: number; groupId?: number } | undefined;
  LiveWorkout: { programId: number };
};

/** Navigation depuis l'onglet Main : change d'onglet ou empile un écran. */
export type MainScreenNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Main'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** Navigation depuis l'onglet Séance : change d'onglet ou empile un écran. */
export type SessionListNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Seance'>,
  NativeStackNavigationProp<RootStackParamList>
>;
