import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

export default function CabinetsScreen() {
  const router = useRouter();
  const colors = useColors();

  const options = [
    {
      id: "create",
      title: "Crear nuevo módulo",
      description: "Diseña un nuevo módulo de cocina",
      icon: "add-circle",
      onPress: () => router.push("/cabinets/create")
    },
    {
      id: "list",
      title: "Listado de módulos",
      description: "Ver y gestionar tus módulos",
      icon: "list",
      onPress: () => router.push("/cabinets/list")
    },
  ];

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header with Back Button */}
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-1 mr-4" style={{minWidth: 0}}>
            <Text className="text-4xl font-bold text-foreground mb-2" numberOfLines={1}>Módulos</Text>
            <Text className="text-base text-muted" numberOfLines={2}>
              Diseña y personaliza tus módulos de cocina
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)")}
            className="bg-primary rounded-full active:opacity-70"
            style={{width: 48, height: 48, alignItems: 'center', justifyContent: 'center', flexShrink: 0}}
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View className="gap-4">
          {options.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={option.onPress}
              className="flex-row items-center bg-surface border border-border rounded-2xl p-5 active:opacity-70"
            >
              <View
                className="w-14 h-14 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.primary + "20" }}
              >
                <MaterialIcons name={option.icon as any} size={28} color={colors.primary} />
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-lg font-bold text-foreground">{option.title}</Text>
                <Text className="text-sm text-muted mt-1">{option.description}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
