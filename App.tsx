import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Provider as PaperProvider, Button, Card, Text, Title, Paragraph } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming
} from 'react-native-reanimated';

export default function App() {
  // Test Reanimated
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { rotate: `${rotation.value}deg` }
      ],
    };
  });

  const handlePress = () => {
    scale.value = withSpring(scale.value === 1 ? 1.2 : 1);
    rotation.value = withSpring(rotation.value + 360);
  };

  return (
    <PaperProvider>
      <LinearGradient
        colors={['#667eea', '#764ba2', '#f093fb']}
        style={styles.container}
      >
        <StatusBar style="light" />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="rocket-launch" size={60} color="white" />
            <Title style={styles.title}>LevelUp Test App</Title>
            <Paragraph style={styles.subtitle}>
              Testing all dependencies ✅
            </Paragraph>
          </View>

          {/* Test Card with Paper */}
          <Card style={styles.card}>
            <Card.Content>
              <Title>React Native Paper ✅</Title>
              <Paragraph>Material Design UI components working!</Paragraph>
            </Card.Content>
          </Card>

          {/* Test Icons */}
          <Card style={styles.card}>
            <Card.Content>
              <Title>Icons Library ✅</Title>
              <View style={styles.iconRow}>
                <MaterialCommunityIcons name="gamepad-variant" size={32} color="#667eea" />
                <MaterialCommunityIcons name="trophy" size={32} color="#f093fb" />
                <MaterialCommunityIcons name="account-group" size={32} color="#764ba2" />
                <MaterialCommunityIcons name="chart-line" size={32} color="#667eea" />
              </View>
            </Card.Content>
          </Card>

          {/* Test Animation */}
          <Card style={styles.card}>
            <Card.Content>
              <Title>Reanimated ✅</Title>
              <Paragraph>Tap the icon to test animation:</Paragraph>
              <View style={styles.animationContainer}>
                <Animated.View style={[animatedStyle]}>
                  <MaterialCommunityIcons
                    name="animation"
                    size={80}
                    color="#667eea"
                    onPress={handlePress}
                  />
                </Animated.View>
              </View>
            </Card.Content>
          </Card>

          {/* Test Button */}
          <Button
            mode="contained"
            style={styles.button}
            buttonColor="#667eea"
            onPress={handlePress}
          >
            Test Animation Button
          </Button>

          {/* Dependencies Status */}
          <Card style={styles.card}>
            <Card.Content>
              <Title>Dependencies Status</Title>
              <Text style={styles.checkItem}>✅ React Native</Text>
              <Text style={styles.checkItem}>✅ TypeScript</Text>
              <Text style={styles.checkItem}>✅ React Native Paper</Text>
              <Text style={styles.checkItem}>✅ Expo Vector Icons</Text>
              <Text style={styles.checkItem}>✅ Linear Gradient</Text>
              <Text style={styles.checkItem}>✅ Reanimated</Text>
              <Text style={styles.checkItem}>✅ Gesture Handler</Text>
            </Card.Content>
          </Card>

          <Text style={styles.footer}>
            Ready to build LevelUp! 🚀
          </Text>
        </ScrollView>
      </LinearGradient>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  card: {
    marginBottom: 15,
    elevation: 4,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  animationContainer: {
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  button: {
    marginBottom: 15,
    borderRadius: 8,
  },
  checkItem: {
    fontSize: 16,
    marginVertical: 4,
  },
  footer: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 30,
  },
});
