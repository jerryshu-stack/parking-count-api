import { Tabs } from 'expo-router';

import { TabIcon } from '@/components/TabIcon';
import { color } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.ink,
        tabBarInactiveTintColor: color.inkTertiary,
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.hairline },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{ title: '地圖', tabBarIcon: ({ focused }) => <TabIcon name="map" focused={focused} /> }}
      />
      <Tabs.Screen
        name="report"
        options={{ title: '回報', tabBarIcon: ({ focused }) => <TabIcon name="report" focused={focused} /> }}
      />
      <Tabs.Screen
        name="community"
        options={{ title: '社群', tabBarIcon: ({ focused }) => <TabIcon name="community" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: '我的', tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} /> }}
      />
    </Tabs>
  );
}
