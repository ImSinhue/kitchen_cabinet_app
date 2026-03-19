import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

interface MaterialOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
}

const materialOptions: MaterialOption[] = [
  {
    id: "create-board",
    title: "Crear Tablero",
    description: "Agregar un nuevo tipo de tablero",
    icon: "add-box",
    route: "/materials/create-board",
    color: "#0a7ea4",
  },
  {
    id: "create-hardware",
    title: "Crear Herrajes",
    description: "Agregar nuevos herrajes",
    icon: "add-circle",
    route: "/materials/create-hardware",
    color: "#22C55E",
  },
  {
    id: "list-boards",
    title: "Listado de Tableros",
    description: "Ver y gestionar tableros",
    icon: "list",
    route: "/materials/list-boards",
    color: "#F59E0B",
  },
  {
    id: "list-hardware",
    title: "Listado de Herrajes",
    description: "Ver y gestionar herrajes",
    icon: "inventory-2",
    route: "/materials/list-hardware",
    color: "#8B5CF6",
  },
];

export default function MaterialsScreen() {
  const router = useRouter();
  const colors = useColors();

  const handleOptionPress = (route: string) => {
    router.push(route as any);
  };

  const renderOption = (option: MaterialOption) => (
    <TouchableOpacity
      key={option.id}
      onPress={() => handleOptionPress(option.route)}
      className="bg-surface border border-border rounded-2xl p-6 mb-4 active:opacity-70"
    >
      <View className="flex-row items-center gap-4">
        <View
          className="rounded-full p-4"
          style={{ backgroundColor: option.color }}
        >
          <MaterialIcons name={option.icon as any} size={32} color="white" />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">
            {option.title}
          </Text>
          <Text className="text-sm text-muted mt-1">{option.description}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header with Back Button */}
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-1 mr-4" style={{minWidth: 0}}>
            <Text className="text-4xl font-bold text-foreground mb-2" numberOfLines={1}>Materiales</Text>
            <Text className="text-base text-muted" numberOfLines={2}>
              Gestiona tableros y herrajes de tu proyecto
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)")}
            className="bg-primary rounded-full p-3 active:opacity-70"
            style={{flexShrink: 0}}
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View className="gap-4">
          {materialOptions.map((option) => renderOption(option))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
