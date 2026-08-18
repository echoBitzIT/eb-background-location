import { StyleSheet } from "react-native";

export const createStyles = (isTablet: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },

    content: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
      zIndex: 1,
    },

    logo: {
      width: isTablet ? 240 : 180,
      height: isTablet ? 240 : 180,
    },

    title: {
      marginTop: 24,
      color: "#FFFFFF",
      fontSize: isTablet ? 38 : 30,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: isTablet ? 48 : 38,
    },
  });
