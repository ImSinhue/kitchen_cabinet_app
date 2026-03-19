import { useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

export default function CreateHardwareScreen() {
  const router = useRouter();
  const colors = useColors();
  const [hardwareName, setHardwareName] = useState("");
  const [type, setType] = useState("hinge");
  const [description, setDescription] = useState("");
  const [specifications, setSpecifications] = useState("");

  const hardwareTypes = [
    { id: "hinge", label: "Bisagra" },
    { id: "drawer-slide", label: "Corredera de Cajon" },
    { id: "handle", label: "Tirador" },
    { id: "knob", label: "Pomo" },
    { id: "shelf-support", label: "Soporte de Estante" },
    { id: "other", label: "Otro" },
  ];

  const handleSave = () => {
    if (!hardwareName.trim()) {
      alert("Por favor ingresa un nombre para el herraje");
      return;
    }
    console.log("Saving hardware:", { hardwareName, type, description, specifications });
    router.back();
  };

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
            Crear Herrajes
          </Text>
          <Text className="text-base text-muted">
            Agrega nuevos herrajes a tu catalogo
          </Text>
        </View>

        <View className="gap-6 mb-8">
          <View>
            <Text className="text-lg font-semibold text-foreground mb-3">
              Nombre del Herraje
            </Text>
            <TextInput
              placeholder="Ej: Bisagra 35mm Regulable"
              placeholderTextColor={colors.muted}
              value={hardwareName}
              onChangeText={setHardwareName}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
            />
          </View>

          <View>
            <Text className="text-lg font-semibold text-foreground mb-3">
              Tipo de Herraje
            </Text>
            <View className="gap-2">
              {hardwareTypes.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setType(opt.id)}
                  className={`border rounded-lg p-4 flex-row items-center justify-between ${
                    type === opt.id
                      ? "bg-primary border-primary"
                      : "border-border bg-surface"
                  }`}
                >
                  <Text
                    className={`text-base font-medium ${
                      type === opt.id ? "text-white" : "text-foreground"
                    }`}
                  >
                    {opt.label}
                  </Text>
                  {type === opt.id && (
                    <MaterialIcons name="check-circle" size={24} color="white" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text className="text-lg font-semibold text-foreground mb-3">
              Descripcion
            </Text>
            <TextInput
              placeholder="Ej: Regulable en 3 ejes, cierre amortiguado"
              placeholderTextColor={colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
            />
          </View>

          <View>
            <Text className="text-lg font-semibold text-foreground mb-3">
              Especificaciones Tecnicas
            </Text>
            <TextInput
              placeholder="Ej: Carga maxima: 50kg, Abertura: 110-180 grados"
              placeholderTextColor={colors.muted}
              value={specifications}
              onChangeText={setSpecifications}
              multiline
              numberOfLines={3}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
            />
          </View>
        </View>

        <View className="gap-3">
          <TouchableOpacity
            onPress={handleSave}
            className="bg-primary rounded-lg py-4 items-center justify-center"
          >
            <Text className="text-white font-semibold text-base">
              Guardar Herraje
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            className="border border-border rounded-lg py-4 items-center justify-center"
          >
            <Text className="text-foreground font-semibold text-base">
              Cancelar
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
