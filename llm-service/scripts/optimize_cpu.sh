#!/bin/bash
# CPU optimization script

echo "Setting CPU performance mode..."

# Set CPU governor to performance
echo "performance" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Disable CPU frequency scaling
sudo cpupower frequency-set -g performance

# Set thread affinity
echo "8" > /proc/sys/kernel/threads-max

# Increase file limits
ulimit -n 65536

echo "✅ CPU optimizations applied"
echo "Note: These settings reset on reboot"