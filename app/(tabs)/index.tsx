import { ScrollView, Text, View, TouchableOpacity, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";


interface Module {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
}


const modules: Module[] = [
  {
    id: "projects",
    title: "Proyectos",
    description: "Gestionar proyectos de armarios",
    icon: "folder",
    route: "/projects",
  },
  {
    id: "cabinets",
    title: "Armarios",
    description: "Diseñar y personalizar armarios",
    icon: "home",
    route: "/cabinets",
  },
  {
    id: "materials",
    title: "Materiales",
    description: "Gestionar tableros y herrajes",
    icon: "palette",
    route: "/materials",
  },
  {
    id: "board-breakdown",
    title: "Despiece de Tableros",
    description: "Carga un PDF de CutList Optimizer y sigue el corte paso a paso",
    icon: "content-cut",
    route: "/board-breakdown",
  },
  {
    id: "settings",
    title: "Configuración",
    description: "Ajustes de la aplicación",
    icon: "settings",
    route: "/settings",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();


  const handleModulePress = (route: string) => {
    router.push(route as any);
  };

  const renderModule = ({ item }: { item: Module }) => (
    <TouchableOpacity
      onPress={() => handleModulePress(item.route)}
      className="bg-surface rounded-2xl p-6 mb-4 border border-border active:opacity-70"
    >
      <View className="flex-row items-center gap-4">
        <View className="bg-primary rounded-full p-3">
          <MaterialIcons name={item.icon as any} size={28} color="white" />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">{item.title}</Text>
          <Text className="text-sm text-muted mt-1">{item.description}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
      </View>
    </TouchableOpacity>
  );



  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-foreground mb-2">Diseño y Despiece de Armarios</Text>
          <Text className="text-base text-muted">
            Diseña y despieza tus armarios de cocina con precisión
          </Text>
        </View>

        {/* Modules Grid */}
        <View className="mb-8">
          <Text className="text-xl font-semibold text-foreground mb-4">Módulos Principales</Text>
          <FlatList
            data={modules}
            renderItem={renderModule}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
