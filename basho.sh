#!/bin/sh 

. '/home/ottersome/.cache/wal/colors.sh';
LOCAT="/home/ottersome/.config/vis/colors/customscheme"
VARIO=''
for i in {1..15}
do
	VARSO="color$i"
	VARIO+="${!VARSO}\n"
done
echo -e $VARIO > $LOCAT
