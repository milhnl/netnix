#!/usr/bin/env sh
#yt_title_clean - clean up music title from youtube

exec sed '
#Some weird characters
s/ / /g; #No-break space
s/⁠//g; #Word joiner
s/—/-/g;
s/⁠—/-/g;
s/–/-/g;
s/—/-/g;

#(Mostly parenthesized)
s/\( *- \)\{0,1\}[Oo][Ff][Ff][Ii][Cc][Ii][Aa][Ll][^][(){}.-]*//;
s/\( *- \)\{0,1\}[Ee][Xx][Tt][Ee][Nn][Dd][Ee][Dd][^][(){}.-]*//;
s/\( *- \)\{0,1\}[Ww][Ii][Tt][Hh] [Ll][Yy][Rr][Ii][Cc][Ss]//;
s/\( *- \)\{0,1\}[Oo][Rr][Ii][Gg][Ii][Nn][Aa][Ll] [Mm][Ii][Xx]//;
s/\( *- \)\{0,1\}[Mm][Uu][Ss][Ii][Cc] [Vv][Ii][Dd][Ee][Oo]//;
s/\( *- \)\{0,1\}[Aa][Uu][Dd][Ii][Oo] [Oo][Nn][Ll][Yy]//;
s/\( *- \)\{0,1\}[Ll][Yy][Rr][Ii][Cc] [Vv][Ii][Dd][Ee][Oo]//;
s/\( *- \)\{0,1\}[Aa][Uu][Dd][Ii][Oo]//;
s/\( *- \)\{0,1\}[Vv][Ii][Dd][Ee][Oo]//;
s/\( *- \)\{0,1\}[Ss][Ii][Nn][Gg][Ll][Ee] [Vv][Ee][Rr][Ss][Ii][Oo][Nn]//;
s/\( *- \)\{0,1\}[Ss][Tt][Uu][Dd][Ii][Oo] [Vv][Ee][Rr][Ss][Ii][Oo][Nn]//;
s/\( *- \)\{0,1\}[Vv][Ii][Ss][Uu][Aa][Ll][Ii][Zz][Ee][Rr]//;
s/\( *- \)\{0,1\}[Ll][Oo][Nn][Gg] [Ee][Dd][Ii][Tt]$//;
s/\( *- \)\{0,1\}[Oo][Uu][Tt] [Nn][Oo][Ww]//;
s/\( *- \)\{0,1\}[Ff][Uu][Ll][Ll] [Ll][Ee][Nn][Gg][Tt][Hh] '`:\
    `'[Vv][Ee][Rr][Ss][Ii][Oo][Nn]//;
s/([^()]*[Vv][Ii][Dd][Ee][Oo])//;
s/[Ll][Ii][Vv][Ee]/Live/;
s/[• ]*[Ll]yrics//;
s/\.mp4//;
s/[({[][0-9]\{3,4\}[Pp]\{0,1\} .*[]})]//; #(1080p gaaarbage)
s/HQ//;
s/HD Video//;
s/1080p//;
s/720p//;
s/ \{0,1\}([12][0-9]\{3\})//;

#Preserve album/ep tag
s/[Ff][Uu][Ll][Ll] [Ee][Pp]$/[EP]/;
s/- \([Ff][Uu][Ll][Ll] \)\{0,1\}[Ee][Pp]$/[EP]/;
s/[({[]\{1,\}\([Ff][Uu][Ll][Ll] \)\{0,1\}[Ee][Pp][]})]\{1,\}/[EP]/;
s/[Ff][Uu][Ll][Ll] [Ll][Pp]/album/;
s/[Ff][Uu][Ll][Ll] [Aa][Ll][Bb][Uu][Mm]/album/;
s/[Aa][Ll][Bb][Uu][Mm] [Ss][Tt][Rr][Ee][Aa][Mm]/album/;
s/\(- \)\{0,1\}[({[]\{0,1\}album[^]})]*[]})]\{0,1\}/[Album]/;

#Clean some remnants
s/ \{2,\}/ /g;
s/ *( *)//g;
s/ *\[ *\]//g;
s/ *{ *}//g;
s/ *$//;
s/- *-/-/g;

#Fix some Artist - Trackname variations
s/\([^ ]\)- /\1 - /;
s/\(.*\) - "\([^"]*\)"$/\1 - \2/;
'"s/\(.*\) - '\([^']*\)'\$/\1 - \2/;"'
/[^-]*-[^-]*$/s/\(.*[^ ]\) *- */\1 - /;
/[^-:]*:[^-:]*$/s/\(.*[^ ]\) *: */\1 - /;
/[^-~]*~[^-~]*$/s/\(.*[^ ]\) *~ */\1 - /;
/[^-"]*"[^-"]*"$/s/\([^"]*\) "\([^"]*\)"/\1 - \2/;
'"/[^-']*'[^-']*'\$/s/\([^']*\) '\([^']*\)'/\1 - \2/;"'
'"/'[^-']*'[^-']*'\$/s/\([^']*\) '\([^']*\)'/\1 - \2/;"'
/[^-●]*●●[^-●]*$/s/\(.*[^ ]\) *●● */\1 - /;
/[^-|]*|[^-|]*$/s/\(.*[^ ]\) *| */\1 - /;
'
