import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { CrossPlatformAlert as Alert } from '../utils/alert';
import { COLORS } from '../theme/colors';
import { createTournament } from '../services/database';

interface CreateTournamentScreenProps {
    userId: string;
    communityId: string;
    communityName: string;
    onBack: () => void;
    onTournamentCreated: () => void;
}

type TournamentFormat = 'single_elimination' | 'double_elimination';

const PARTICIPANT_OPTIONS = [4, 8, 16, 32];

export default function CreateTournamentScreen({
    userId,
    communityId,
    communityName,
    onBack,
    onTournamentCreated
}: CreateTournamentScreenProps) {
    const [name, setName] = useState('');
    const [format, setFormat] = useState<TournamentFormat>('single_elimination');
    const [minParticipants, setMinParticipants] = useState(4);
    const [maxParticipants, setMaxParticipants] = useState(8);
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        // Validation
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter a tournament name');
            return;
        }

        if (name.length < 3) {
            Alert.alert('Error', 'Tournament name must be at least 3 characters');
            return;
        }

        if (name.length > 50) {
            Alert.alert('Error', 'Tournament name must be less than 50 characters');
            return;
        }

        if (minParticipants > maxParticipants) {
            Alert.alert('Error', 'Minimum participants cannot exceed maximum participants');
            return;
        }

        setCreating(true);
        try {
            // Default registration ends in 24 hours
            const registrationEndsAt = new Date();
            registrationEndsAt.setDate(registrationEndsAt.getDate() + 1);

            const { data, error } = await createTournament(
                communityId,
                userId,
                name.trim(),
                '', // description (empty for now)
                format,
                maxParticipants,
                registrationEndsAt
            );

            if (error) throw error;

            Alert.alert(
                'Tournament Created!',
                `"${name}" has been created. Members can now register!`,
                [{ text: 'OK', onPress: onTournamentCreated }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to create tournament');
        } finally {
            setCreating(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create Tournament</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Community Info */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Community</Text>
                    <Text style={styles.infoValue}>{communityName}</Text>
                </View>

                {/* Tournament Name */}
                <View style={styles.section}>
                    <Text style={styles.label}>Tournament Name *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter tournament name..."
                        value={name}
                        onChangeText={setName}
                        maxLength={50}
                        autoCapitalize="words"
                    />
                    <Text style={styles.helperText}>{name.length}/50 characters</Text>
                </View>

                {/* Format Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>Tournament Format</Text>

                    <TouchableOpacity
                        style={[
                            styles.formatOption,
                            format === 'single_elimination' && styles.formatOptionSelected
                        ]}
                        onPress={() => setFormat('single_elimination')}
                    >
                        <View style={styles.radioOuter}>
                            {format === 'single_elimination' && <View style={styles.radioInner} />}
                        </View>
                        <View style={styles.formatContent}>
                            <Text style={styles.formatTitle}>🏆 Single Elimination</Text>
                            <Text style={styles.formatDescription}>
                                Lose once and you're out. Fast-paced bracket style.
                            </Text>
                        </View>
                    </TouchableOpacity>

            
                </View>

                {/* Participant Limits */}
                <View style={styles.section}>
                    <Text style={styles.label}>Minimum Participants</Text>
                    <Text style={styles.helperText}>
                        Tournament will start when this many players register
                    </Text>
                    <View style={styles.optionsGrid}>
                        {PARTICIPANT_OPTIONS.map((count) => (
                            <TouchableOpacity
                                key={`min-${count}`}
                                style={[
                                    styles.optionButton,
                                    minParticipants === count && styles.optionButtonSelected,
                                    count > maxParticipants && styles.disabledOption
                                ]}
                                onPress={() => setMinParticipants(count)}
                                disabled={count > maxParticipants}
                            >
                                <Text
                                    style={[
                                        styles.optionButtonText,
                                        minParticipants === count && styles.optionButtonTextSelected,
                                        count > maxParticipants && styles.disabledText
                                    ]}
                                >
                                    {count}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Maximum Participants</Text>
                    <Text style={styles.helperText}>
                        Registration will close when this limit is reached
                    </Text>
                    <View style={styles.optionsGrid}>
                        {PARTICIPANT_OPTIONS.map((count) => (
                            <TouchableOpacity
                                key={`max-${count}`}
                                style={[
                                    styles.optionButton,
                                    maxParticipants === count && styles.optionButtonSelected,
                                    count < minParticipants && styles.disabledOption
                                ]}
                                onPress={() => setMaxParticipants(count)}
                                disabled={count < minParticipants}
                            >
                                <Text
                                    style={[
                                        styles.optionButtonText,
                                        maxParticipants === count && styles.optionButtonTextSelected,
                                        count < minParticipants && styles.disabledText
                                    ]}
                                >
                                    {count}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Tournament Rules Info */}
                <View style={styles.rulesCard}>
                    <Text style={styles.rulesTitle}>📋 Tournament Rules</Text>
                    <Text style={styles.rulesText}>• Members register during open registration period</Text>
                    <Text style={styles.rulesText}>• Tournament starts when minimum participants reached</Text>
                    <Text style={styles.rulesText}>• Bracket seeding based on player ELO (highest to lowest)</Text>
                    <Text style={styles.rulesText}>• All matches use standard quiz format (10 questions)</Text>
                    <Text style={styles.rulesText}>• Match results count toward player ELO ratings</Text>
                    <Text style={styles.rulesText}>• Winner advances, loser is eliminated (single elimination)</Text>
                </View>

                {/* Create Button */}
                <TouchableOpacity
                    style={[styles.createButton, creating && styles.disabledButton]}
                    onPress={handleCreate}
                    disabled={creating}
                >
                    {creating ? (
                        <ActivityIndicator color="white" size="small" />
                    ) : (
                        <Text style={styles.createButtonText}>Create Tournament</Text>
                    )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 16,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backButton: {
        backgroundColor: COLORS.white,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    backButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    headerSpacer: {
        width: 60,
    },
    content: {
        flex: 1,
    },
    infoCard: {
        backgroundColor: COLORS.primaryLight,
        padding: 16,
        marginTop: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
    infoLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    infoValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    section: {
        padding: 20,
        backgroundColor: 'white',
        marginTop: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
        backgroundColor: '#F9F9F9',
        marginBottom: 4,
    },
    helperText: {
        fontSize: 12,
        color: '#999',
        marginBottom: 8,
    },
    formatOption: {
        flexDirection: 'row',
        padding: 16,
        borderWidth: 2,
        borderColor: '#DDD',
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: 'white',
    },
    formatOptionSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryLight,
    },
    radioOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#DDD',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        marginTop: 2,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: COLORS.primary,
    },
    formatContent: {
        flex: 1,
    },
    formatTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    formatDescription: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 8,
    },
    optionButton: {
        width: 70,
        height: 50,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#DDD',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
    },
    optionButtonSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryLight,
    },
    optionButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#666',
    },
    optionButtonTextSelected: {
        color: COLORS.primary,
    },
    rulesCard: {
        backgroundColor: '#FFF9E6',
        padding: 16,
        marginTop: 12,
        marginHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FFE082',
    },
    rulesTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    rulesText: {
        fontSize: 13,
        color: '#666',
        marginBottom: 6,
        lineHeight: 18,
    },
    createButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginHorizontal: 20,
        marginTop: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    createButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    disabledButton: {
        backgroundColor: '#CCC',
        opacity: 0.6,
    },
    disabledOption: {
        opacity: 0.4,
    },
    disabledText: {
        color: '#999',
    },
});
