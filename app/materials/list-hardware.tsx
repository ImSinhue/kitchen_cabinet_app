import { useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

interface Hardware {
  id: string;
  name: string;
  type: string;
  description: string;
}

const defaultHardware: Hardware[] = [
  {
    id: "1",
    name: "Bisagra 35mm Regulable",
    type: "Bisagra",
    description: "Regulable en 3 ejes, cierre amortiguado",
  },
  {
    id: "2",
    name: "Corredera Suave 500mm",
    type: "Corredera",
    description: "Cierre amortiguado, carga maxima 50kg",
  },
  {
    id: "3",
    name: "Tirador Acero Inoxidable",
    type: "Tirador",
    description: "Acabado cromado, 128mm de largo",
  },
];

export default function ListHardwareScreen() {
  const router = useRouter();
  const colors = useColors();
  const [hardware, setHardware] = useState<Hardware[]>(defaultHardware);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setHardware(hardware.filter((h) => h.id !== id));
    setSelectedId(null);
  };

  const renderHardware = ({ item }: { item: Hardware }) => (
    <TouchableOpacity
      onPress={() => setSelectedId(selectedId === item.id ? null : item.id)}
      className={`border rounded-lg p-4 mb-3 ${
        selectedId === item.id
          ? "bg-primary border-primary"
          : "bg-surface border-border"
      }`}
    >
      <View className="flex-row items-start gap-3">
        <View
          className="w-12 h-12 rounded-lg items-center justify-center"
          style={{ backgroundColor: selectedId === item.id ? "rgba(255,255,255,0.2)" : colors.border }}
        >
          <MaterialIcons
            name="hardware"
            size={24}
            color={selectedId === item.id ? "white" : colors.primary}
          />
        </View>
        <View className="flex-1">
          <Text
            className={`text-base font-semibold ${
              selectedId === item.id ? "text-white" : "text-foreground"
            }`}
          >
            {item.name}
          </Text>
          <Text
            className={`text-sm mt-1 ${
              selectedId === item.id ? "text-gray-200" : "text-muted"
            }`}
          >
            {item.type}
          </Text>
          <Text
            className={`text-sm mt-1 ${
              selectedId === item.id ? "text-gray-200" : "text-muted"
            }`}
          >
            {item.description}
          </Text>
        </View>
        {selectedId === item.id && (
          <MaterialIcons name="check-circle" size={24} color="white" />
        )}
      </View>

      {selectedId === item.id && (
        <View className="flex-row gap-2 mt-4">
          <TouchableOpacity className="flex-1 bg-white rounded-lg py-2 items-center justify-center">
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="edit" size={18} color={colors.primary} />
              <Text className="text-primary font-semibold text-sm">Editar</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            className="flex-1 bg-error rounded-lg py-2 items-center justify-center"
          >
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="delete" size={18} color="white" />
              <Text className="text-white font-semibold text-sm">Eliminar</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center gap-2 mb-4"
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
            <Text className="text-base font-semibold text-primary">Volver</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground mb-2">
            Listado de Herrajes
          </Text>
          <Text className="text-base text-muted">
            Gestiona tus herrajes disponibles
          </Text>
        </View>

        <View className="mb-6">
          <FlatList
            data={hardware}
            renderItem={renderHardware}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>

        {hardware.length === 0 && (
          <View className="bg-surface border border-border rounded-2xl p-6 items-center justify-center py-12">
            <MaterialIcons name="inbox" size={48} color={colors.muted} />
            <Text className="text-center text-foreground font-semibold mt-4 text-lg">
              No hay herrajes
            </Text>
            <Text className="text-center text-muted mt-2">
              Crea nuevos herrajes para comenzar
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => router.push("/materials/create-hardware")}
          className="bg-primary rounded-lg py-4 items-center justify-center"
        >
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="add" size={24} color="white" />
            <Text className="text-white font-semibold">Agregar Herraje</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
