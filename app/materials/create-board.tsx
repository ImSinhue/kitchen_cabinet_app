import { useState } from "react";
import { View, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { Text } from "react-native";

export default function CreateBoardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  
  const [boardName, setBoardName] = useState("");
  const [width, setWidth] = useState("2850");
  const [height, setHeight] = useState("2100");
  const [thickness, setThickness] = useState("16");
  const [materialType, setMaterialType] = useState("melamine");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const createBoardMutation = trpc.boards.create.useMutation();

  const materialTypes = [
    { id: "melamine", label: "Melamina" },
    { id: "mdf", label: "MDF" },
    { id: "solid-wood", label: "Madera" },
    { id: "other", label: "Otro" },
  ];

  const resetForm = () => {
    setBoardName("");
    setWidth("2850");
    setHeight("2100");
    setThickness("16");
    setMaterialType("melamine");
    setPrice("");
    setStock("");
    setShowSuccess(false);
  };

  const handleSave = async () => {
    console.log("[CreateBoard] handleSave called");

    if (!boardName.trim()) {
      Alert.alert("Error", "Nombre requerido");
      return;
    }
    if (!price.trim()) {
      Alert.alert("Error", "Precio requerido");
      return;
    }
    if (!stock.trim()) {
      Alert.alert("Error", "Cantidad requerida");
      return;
    }

    // Validar que el precio sea un número válido
    if (isNaN(parseFloat(price))) {
      Alert.alert("Error", "Precio debe ser un número válido");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        name: boardName,
        materialType,
        width: parseInt(width) || 2850,
        height: parseInt(height) || 2100,
        thickness: parseInt(thickness) || 16,
        price,
        quantity: parseInt(stock) || 0,
      };
      console.log("[CreateBoard] Payload:", payload);
      
      await createBoardMutation.mutateAsync(payload);
      console.log("[CreateBoard] Success");
      
      // Mostrar pantalla de éxito
      setShowSuccess(true);
    } catch (error: any) {
      console.error("[CreateBoard] Error:", error);
      Alert.alert("Error", error?.message || "Error al guardar");
    } finally {
      setIsLoading(false);
    }
  };

  // Pantalla de éxito
  if (showSuccess) {
    return (
      <ScreenContainer className="p-4">
        <View className="flex-1 justify-center items-center gap-8">
          <View className="items-center gap-4">
            <View className="w-20 h-20 bg-success rounded-full items-center justify-center">
              <MaterialIcons name="check" size={40} color="white" />
            </View>
            <Text className="text-3xl font-bold text-foreground text-center">
              ¡Tablero guardado!
            </Text>
            <Text className="text-base text-muted text-center">
              {boardName} se ha creado exitosamente
            </Text>
          </View>

          <View className="gap-4 w-full">
            <TouchableOpacity
              onPress={resetForm}
              className="bg-primary rounded-lg py-4 items-center justify-center"
            >
              <Text className="text-white font-semibold text-lg">
                Crear nuevo tablero
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.back()}
              className="border-2 border-primary rounded-lg py-4 items-center justify-center"
            >
              <Text className="text-primary font-semibold text-lg">
                Volver al menú
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // Pantalla de formulario
  return (
    <ScreenContainer className="p-4">
      <View className="flex-1">
        {/* Header */}
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center gap-2 mb-3"
          >
            <MaterialIcons name="arrow-back" size={28} color={colors.primary} />
            <Text className="text-lg font-semibold text-primary">Volver</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground">Crear Tablero</Text>
        </View>

        {/* Form Fields - Compact Layout */}
        <View className="gap-4 flex-1">
          {/* Row 1: Nombre */}
          <View>
            <Text className="text-base font-semibold text-foreground mb-2">Nombre</Text>
            <TextInput
              placeholder="Ej: Melamina Blanca"
              placeholderTextColor={colors.muted}
              value={boardName}
              onChangeText={setBoardName}
              className="bg-surface border border-border rounded-lg px-4 py-3.5 text-lg text-foreground"
            />
          </View>

          {/* Row 2: Dimensiones */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground mb-2">Ancho</Text>
              <TextInput
                placeholder="2850"
                placeholderTextColor={colors.muted}
                value={width}
                onChangeText={setWidth}
                keyboardType="number-pad"
                className="bg-surface border border-border rounded-lg px-3 py-3 text-lg text-foreground"
              />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground mb-2">Alto</Text>
              <TextInput
                placeholder="2100"
                placeholderTextColor={colors.muted}
                value={height}
                onChangeText={setHeight}
                keyboardType="number-pad"
                className="bg-surface border border-border rounded-lg px-3 py-3 text-lg text-foreground"
              />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground mb-2">Espesor</Text>
              <TextInput
                placeholder="16"
                placeholderTextColor={colors.muted}
                value={thickness}
                onChangeText={setThickness}
                keyboardType="number-pad"
                className="bg-surface border border-border rounded-lg px-3 py-3 text-lg text-foreground"
              />
            </View>
          </View>

          {/* Row 3: Material Type */}
          <View>
            <Text className="text-base font-semibold text-foreground mb-2">Material</Text>
            <View className="flex-row flex-wrap gap-2">
              {materialTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  onPress={() => setMaterialType(type.id)}
                  className={`flex-1 min-w-[22%] py-3 px-2 rounded border ${
                    materialType === type.id
                      ? "bg-primary border-primary"
                      : "bg-surface border-border"
                  }`}
                >
                  <Text
                    className={`text-center text-base font-medium ${
                      materialType === type.id ? "text-white" : "text-foreground"
                    }`}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Row 4: Precio y Cantidad */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground mb-2">Precio (€)</Text>
              <TextInput
                placeholder="45.50"
                placeholderTextColor={colors.muted}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                className="bg-surface border border-border rounded-lg px-3 py-3 text-lg text-foreground"
              />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground mb-2">Cantidad</Text>
              <TextInput
                placeholder="10"
                placeholderTextColor={colors.muted}
                value={stock}
                onChangeText={setStock}
                keyboardType="number-pad"
                className="bg-surface border border-border rounded-lg px-3 py-3 text-lg text-foreground"
              />
            </View>
          </View>

          {/* Resumen compacto */}
          <View className="bg-surface border border-border rounded-lg p-4 mt-2">
            <Text className="text-base font-semibold text-foreground mb-3">Resumen</Text>
            <View className="gap-2.5">
              <View className="flex-row justify-between">
                <Text className="text-base text-muted">Nombre:</Text>
                <Text className="text-base font-medium text-foreground">
                  {boardName || "-"}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-base text-muted">Dim:</Text>
                <Text className="text-base font-medium text-foreground">
                  {width}x{height}x{thickness}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-base text-muted">Material:</Text>
                <Text className="text-base font-medium text-foreground">
                  {materialTypes.find((t) => t.id === materialType)?.label}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-base text-muted">Precio/Cant:</Text>
                <Text className="text-base font-medium text-foreground">
                  €{price || "0"} / {stock || "0"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View className="gap-3 mt-6">
          <TouchableOpacity
            onPress={handleSave}
            disabled={isLoading}
            className="bg-primary rounded-lg py-4 items-center justify-center"
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-lg">Guardar</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            className="border border-border rounded-lg py-4 items-center justify-center"
          >
            <Text className="text-foreground font-semibold text-lg">Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
