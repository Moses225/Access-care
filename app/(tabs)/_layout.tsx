import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Find Care',
          tabBarIcon: ({ color }) => <FontAwesome size={22} name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Appointments',
          tabBarIcon: ({ color }) => <FontAwesome size={22} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="recovery-housing"
        options={{
          title: 'Recovery',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'leaf' : 'leaf-outline'}
              size={24}
              color={focused ? '#16A34A' : color}
            />
          ),
          tabBarActiveTintColor: '#16A34A',
          tabBarLabel: 'Recovery',
        }}
      />
      <Tabs.Screen
        name="insurance"
        options={{
          title: 'Coverage',
          tabBarIcon: ({ color }) => <FontAwesome size={22} name="shield" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <FontAwesome size={22} name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
