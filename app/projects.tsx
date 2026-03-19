import { ScrollView, Text, View, TouchableOpacity, FlatList } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useCallback } from "react";

interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export default function ProjectsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [projects, setProjects] = useState<Project[]>([]);

  const loadProjects = useCallback(async () => {
    try {
      const projectsData = await AsyncStorage.getItem("projects");
      if (projectsData) {
        const parsedProjects = JSON.parse(projectsData);
        console.log("Projects loaded:", parsedProjects);
        setProjects(parsedProjects);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      setProjects([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

  const handleDeleteProject = async (projectId: string) => {
    try {
      const projectsData = await AsyncStorage.getItem("projects");
      if (projectsData) {
        const allProjects = JSON.parse(projectsData);
        const updatedProjects = allProjects.filter((p: Project) => p.id !== projectId);
        await AsyncStorage.setItem("projects", JSON.stringify(updatedProjects));
        loadProjects();
      }
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const handleEditProject = (project: Project) => {
    // TODO: Implement edit project functionality
    console.log("Edit project:", project);
  };

  const renderProject = ({ item }: { item: Project }) => (
    <View className="bg-surface rounded-2xl p-6 mb-4 border border-border flex-row items-center gap-4">
      <TouchableOpacity
        onPress={() => router.push({ pathname: "/project-summary", params: { projectId: item.id } })}
        className="flex-1 flex-row items-center gap-4 active:opacity-70"
      >
        <View className="bg-primary rounded-full p-3">
          <MaterialIcons name="folder" size={28} color="white" />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">{item.name}</Text>
          <Text className="text-sm text-muted mt-1">
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
      </TouchableOpacity>
      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => handleEditProject(item)}
          className="p-2 active:opacity-70"
        >
          <MaterialIcons name="edit" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteProject(item.id)}
          className="p-2 active:opacity-70"
        >
          <MaterialIcons name="delete" size={24} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header with Back Button */}
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-1 mr-4" style={{minWidth: 0}}>
            <Text className="text-4xl font-bold text-foreground mb-2" numberOfLines={1}>Proyectos</Text>
            <Text className="text-base text-muted" numberOfLines={2}>
              Gestiona tus proyectos de armarios
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

        {/* New Project Button */}
        <TouchableOpacity
          onPress={() => router.push("/new-project")}
          className="bg-primary rounded-2xl p-6 mb-8 active:opacity-80"
        >
          <View className="flex-row items-center gap-4">
            <View className="bg-white rounded-full p-3">
              <MaterialIcons name="add" size={28} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-white">Nuevo Proyecto</Text>
              <Text className="text-sm text-white opacity-80 mt-1">Crear un nuevo proyecto de armarios</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="white" />
          </View>
        </TouchableOpacity>

        {/* Projects List */}
        <View>
          <Text className="text-xl font-semibold text-foreground mb-4">Listado de Proyectos</Text>
          {projects.length > 0 ? (
            <FlatList
              data={projects}
              renderItem={renderProject}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View className="bg-surface rounded-2xl p-6 border border-border items-center justify-center py-12">
              <MaterialIcons name="folder-open" size={48} color={colors.muted} />
              <Text className="text-center text-muted mt-4">No hay proyectos</Text>
              <Text className="text-center text-muted text-sm mt-2">
                Crea un nuevo proyecto para comenzar
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
