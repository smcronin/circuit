import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Animated as RNAnimated, Platform } from 'react-native';
import Svg, { Path, Defs, RadialGradient, LinearGradient, Stop, G } from 'react-native-svg';

const AnimatedPath = RNAnimated.createAnimatedComponent(Path);
const AnimatedG = RNAnimated.createAnimatedComponent(G);
import { colors, spacing, typography } from '@/theme';

const MESSAGES = [
  'Initializing neural pathways...',
  'Etching circuit patterns...',
  'Calibrating workout parameters...',
  'Optimizing exercise selection...',
  'Finalizing your challenge...',
];

// Path data for the Circuit logo
const PATHS = {
  main: "M696.499084,700.551025 C655.936218,730.297241 610.644592,746.916626 561.362366,753.471741 C543.502441,755.847290 525.575989,757.548157 507.604065,756.932678 C473.099548,755.751038 438.988098,751.219421 405.457550,742.764099 C367.491089,733.190125 331.057861,719.697571 297.019165,700.144897 C286.759277,694.251404 276.754486,687.927795 267.141937,681.024780 C263.540619,678.438660 259.782959,676.947998 255.364197,676.119263 C224.892532,670.404114 208.457703,649.582397 203.708496,620.075806 C202.594574,613.155090 202.244019,606.154907 203.015228,599.157837 C203.233383,597.178711 202.424713,595.584717 201.683716,593.924988 C192.548035,573.462524 188.160934,551.951050 186.540421,529.655212 C185.482910,515.105347 186.572388,500.728882 187.740692,486.300751 C187.918427,484.105743 188.106628,481.935181 190.709702,481.072388 C201.774353,477.404907 212.827988,473.704163 223.895889,470.046631 C224.322174,469.905762 224.853821,470.083740 225.987350,470.152771 C224.927078,474.751892 223.804031,479.171906 222.895279,483.635590 C214.718903,523.796326 217.056107,562.824097 236.280121,599.758667 C243.821960,614.248596 254.100815,626.680420 267.431641,636.385315 C268.620605,637.250854 269.724823,638.232910 270.996765,639.265137 C265.683685,640.834106 253.975861,636.839844 236.567535,627.546570 C241.309662,638.318726 247.678284,646.693848 257.364288,652.322815 C265.982666,657.331360 275.318085,660.230530 285.168396,661.490601 C287.027466,661.728455 288.724762,662.115601 290.307587,663.170959 C335.521454,693.318176 385.865082,710.477661 438.585846,721.515686 C471.164124,728.336670 504.149597,730.794312 537.379150,729.539368 C547.787292,729.146301 558.205017,728.146484 569.334534,726.003357 C554.371277,714.375549 542.150818,701.220276 532.848450,684.947937 C535.353333,684.294556 536.615417,685.867676 537.985107,686.742676 C553.014648,696.344116 569.074219,703.405701 586.689026,706.658203 C605.713257,710.171143 623.790710,706.383301 641.310486,699.167114 C663.585571,689.992371 682.233704,675.450317 698.774841,658.318604 C723.564453,632.644043 742.726379,603.140076 756.310669,570.080139 C756.943420,568.540222 757.559570,566.989868 758.094604,565.414185 C761.203979,556.258606 763.613342,556.825317 751.991089,553.400391 C708.085632,540.461792 664.332031,540.900757 620.915039,556.016846 C592.062500,566.062256 566.831726,581.636108 546.330383,604.509399 C545.554016,605.375549 544.712952,606.194031 543.827209,606.946655 C543.483887,607.238342 542.932434,607.285156 541.720398,607.705444 C547.855652,586.412109 558.146484,568.432800 575.409485,554.119141 C569.396362,548.136963 562.989563,543.209045 556.084290,539.011292 C528.287781,522.113892 498.088928,515.425049 465.712067,517.927673 C443.296448,519.660339 422.116241,525.259888 402.714905,536.925964 C397.096039,540.304688 392.221191,544.531982 387.580078,549.118530 C372.694336,563.829346 354.752899,572.795837 334.374084,577.064331 C332.787354,577.396729 331.117981,577.334961 328.958801,577.495667 C329.940735,575.125671 331.790039,574.685425 333.266388,573.961365 C370.018890,555.935791 392.656036,527.151611 400.118378,486.671173 C401.949158,476.739929 402.386688,466.845184 400.508148,456.909943 C400.115723,454.834473 399.846741,452.618347 398.074280,450.545593 C383.351715,454.256836 372.200439,464.148407 360.041840,472.545959 C367.216278,452.235321 377.474884,434.404083 397.531921,423.575073 C389.921906,422.648743 382.311890,421.722382 374.330200,420.750793 C375.197662,418.090576 377.249390,418.070648 378.802216,417.539948 C405.115112,408.547272 431.445038,399.604462 457.769989,390.646942 C473.375397,385.336914 488.979034,380.021515 504.582703,374.706268 C511.265106,372.429993 517.364563,369.157715 523.179443,363.747986 C501.956055,365.842255 482.447174,365.056519 471.337372,342.521393 C461.588501,345.623230 451.507874,348.830597 441.427246,352.037994 C441.373322,352.425293 441.319397,352.812592 441.265472,353.199890 C454.142700,358.564270 467.019897,363.928650 479.897125,369.293030 C479.868683,369.766144 479.840240,370.239258 479.811798,370.712341 C360.065948,410.463257 240.781754,451.572662 120.820122,492.549469 C123.680489,486.852814 183.404770,455.869019 231.777023,433.742981 C269.773926,416.362762 307.867554,399.225311 347.889130,382.787750 C337.291138,379.896851 327.976044,377.355896 318.660980,374.814972 C318.575989,374.259064 318.490997,373.703186 318.406036,373.147308 C339.895416,365.748810 361.384796,358.350311 382.874176,350.951813 C382.931091,350.441132 382.988007,349.930450 383.044891,349.419800 C370.743134,345.113556 358.441345,340.807343 346.139557,336.501099 C346.137634,335.992981 346.135742,335.484833 346.133820,334.976715 C386.987701,321.822815 427.841553,308.668915 469.413574,295.283783 C465.499481,291.708954 463.214905,287.597778 457.705597,286.306458 C460.589020,284.137695 463.251678,282.648804 463.292908,279.060577 C465.120697,283.065948 466.062897,287.048645 469.674377,289.409851 C473.072021,291.631287 474.888550,290.919800 475.536774,286.930389 C475.957184,284.342987 475.932678,281.666595 477.617004,279.316132 C480.263367,280.175049 481.115570,282.015686 481.387421,284.571960 C482.507080,295.099823 490.282684,301.783752 496.188232,309.490631 C498.277679,312.217438 501.932983,309.449951 505.595764,311.146667 C495.398071,319.030334 495.836609,329.620239 497.212097,340.721283 C494.700958,341.099762 493.660767,339.281006 492.689026,337.702362 C491.283966,335.419922 489.623413,334.783630 487.305786,336.248779 C485.133240,337.622192 483.882751,339.394104 484.807983,342.098358 C485.417633,343.880157 486.377411,345.418915 487.957275,346.487579 C496.423035,352.213898 505.597412,354.108002 515.557617,351.441498 C518.477600,350.659790 520.387756,348.477570 521.866455,346.028503 C527.033447,337.470947 531.712463,328.648529 535.734436,319.490540 C539.800537,310.232025 536.298340,301.824829 532.379822,293.678497 C528.412964,285.431610 523.895386,277.449677 519.625122,269.348450 C519.253479,268.643463 518.636414,267.951874 519.611877,266.749054 C523.079102,268.860992 525.793945,271.909668 528.681458,274.706085 C535.537048,281.345245 541.675110,288.567230 545.987366,297.169434 C550.653198,306.476868 551.664246,315.802307 546.469971,325.361877 C542.270264,333.091125 539.311707,341.441681 534.521606,348.767517 C542.569885,355.357910 554.608276,354.149780 561.830444,346.215790 C569.032288,338.304077 575.236755,329.597931 580.640564,320.405762 C584.762512,313.394104 582.740173,305.816742 580.977539,298.524353 C578.579895,288.605499 574.640625,279.241394 570.167358,270.094330 C569.096802,267.905334 567.824158,265.763397 567.921875,263.258179 C569.678040,262.453857 570.270142,263.744171 571.033447,264.478241 C582.084900,275.106628 589.518250,288.019348 594.408203,302.404175 C597.578552,311.730164 595.756104,320.557281 590.160156,328.514221 C584.913330,335.974762 579.391602,343.242096 573.994690,350.589355 C579.928589,355.305634 592.396484,355.235474 599.335815,350.202057 C608.943298,343.233368 615.749817,333.766296 622.287659,323.660645 C617.210449,322.990631 612.337952,322.347656 606.169128,321.533600 C610.903381,317.980713 614.652588,318.959473 618.317383,319.455566 C625.186646,320.385498 625.332886,320.279022 626.939697,313.426849 C629.134583,304.066620 625.802246,295.641968 622.325623,287.339203 C619.497498,280.585144 616.091370,274.075195 613.084839,267.392517 C612.103577,265.211517 610.534912,263.073608 611.327637,260.128754 C615.199402,261.432007 617.004639,264.796173 619.330811,267.450470 C626.956177,276.151764 633.236755,285.767975 637.563293,296.521759 C641.610962,306.582092 640.781738,316.439911 635.095215,325.705414 C630.130005,333.795746 624.932068,341.742706 618.339111,349.419495 C626.134766,349.833405 633.506165,350.274231 640.883057,350.585571 C643.027039,350.676056 644.853149,349.368378 646.064575,347.874207 C655.267883,336.522583 664.706116,325.304230 668.117798,310.490692 C669.189575,305.836914 668.193604,301.493164 666.703674,297.275452 C662.794556,286.209656 657.361572,275.936249 649.903503,266.798126 C648.194214,264.703857 645.975586,263.242554 643.323730,261.394318 C645.409058,260.389496 646.635803,259.351562 645.684448,256.788452 C642.764709,248.922226 636.918030,244.992538 629.090027,243.256683 C623.833923,242.091171 618.581238,241.996368 613.298462,242.572098 C611.715332,246.228500 615.713806,249.212036 613.998474,253.291351 C606.739990,248.012512 601.895874,239.631546 593.043396,237.570053 C584.469116,235.573334 575.631775,235.455490 566.852295,237.683472 C566.690552,241.955383 569.342896,245.570007 568.093628,250.455063 C565.171448,247.715927 562.659607,245.403107 560.193420,243.042587 C548.740662,232.080688 537.633789,230.203369 520.702759,237.740387 C517.506836,239.163071 517.036499,240.883911 518.704651,243.935898 C520.493103,247.208038 522.499329,250.510345 522.822510,254.466583 C520.210022,255.319107 519.003601,253.478180 517.977966,252.284637 C507.247620,239.797501 494.364990,239.591797 479.391266,243.346329 C467.834473,246.244110 459.654907,251.541031 453.923035,261.855591 C448.349243,271.885803 441.002991,280.876556 435.947205,291.254364 C434.020599,295.209137 429.815460,295.366913 425.800507,298.096710 C426.085114,291.142883 428.598206,285.873474 429.940796,279.804352 C422.008118,281.025543 414.657654,283.465790 407.319427,285.714600 C373.041962,296.219086 340.443970,310.335175 311.181610,331.419861 C280.388306,353.607605 255.409515,380.836670 238.706940,415.207214 C237.943756,416.777740 237.094238,417.972900 235.446396,418.738068 C224.269211,423.928101 213.131424,429.203033 201.964813,434.415985 C201.592514,434.589813 201.048553,434.395905 200.208313,434.355164 C200.779617,429.867889 203.022156,426.138977 204.658890,422.285645 C221.316803,383.068390 246.967926,350.874664 280.719757,324.956329 C323.247803,292.298615 371.771027,273.430878 423.806763,262.876984 C433.805084,260.849060 441.779510,257.799316 446.470154,247.882050 C450.470978,239.423218 457.939484,234.883026 467.309692,233.261841 C480.072052,231.053787 492.614655,227.212128 505.821716,228.872833 C508.761505,229.242523 511.370636,227.901291 513.896240,226.618576 C527.564575,219.676666 541.543213,218.641846 555.915710,224.249359 C558.580017,225.288849 561.172241,225.434189 564.139954,224.857498 C576.263306,222.501587 588.571167,222.675278 600.096924,226.984009 C609.209900,230.390762 618.518860,229.104065 627.662170,230.543198 C640.560181,232.573273 651.131104,237.537476 657.314148,249.815781 C660.379456,255.903061 664.072754,261.671509 667.369324,267.646301 C668.673706,270.010284 670.290405,270.854248 673.057007,270.409210 C685.533203,268.402374 698.095703,266.883972 710.510315,264.564392 C716.345520,263.474121 721.934387,261.023895 727.604797,259.101196 C748.257874,252.098267 768.886108,245.022171 789.554932,238.066315 C793.051331,236.889664 795.271667,235.409668 796.336853,231.276016 C798.848633,221.529572 806.084534,216.219086 815.765015,215.001556 C825.375854,213.792770 833.678040,217.159180 839.132446,225.413284 C844.298462,233.231033 843.548157,243.706131 838.015320,251.284805 C829.744629,262.613800 812.323608,263.880768 801.879089,253.548477 C799.034424,250.734467 796.697510,250.332855 793.127075,251.560013 C769.830383,259.566986 746.480957,267.421021 723.136047,275.287262 C708.856140,280.098999 693.899597,281.621765 679.166199,284.224731 C678.210632,284.393555 677.266602,284.627899 675.840759,284.934021 C677.731934,291.149475 680.644043,296.766846 681.502319,303.064819 C682.583557,310.998505 681.288696,318.423309 677.361877,325.216949 C672.122070,334.282257 667.604126,343.808167 660.958801,352.022827 C660.350342,352.775055 659.985718,353.724548 659.565125,354.479614 C660.119934,356.523407 661.866638,357.083801 663.187500,357.969849 C681.948730,370.554840 676.969910,400.517487 663.690796,409.871521 C657.438660,414.275696 650.159119,415.676605 642.902832,416.113556 C628.944580,416.954071 614.985657,417.253540 601.217651,420.209625 C592.253296,422.134308 583.728394,419.423218 575.373901,416.414093 C572.712830,415.455658 570.045105,414.449860 567.524780,413.179443 C560.054993,409.414093 552.560547,408.882446 544.322144,410.920807 C521.885193,416.472015 500.306183,413.538757 479.995483,402.465302 C475.776733,400.165283 473.460083,400.923615 470.512390,404.657837 C458.674286,419.654785 444.780701,432.561646 429.085327,443.486664 C427.139160,444.841278 426.004822,446.060211 426.847717,448.790314 C432.170502,466.030823 431.541473,483.249817 426.231293,500.391815 C426.002167,501.131409 425.926178,501.918427 425.723389,502.971375 C434.681000,501.052032 443.174225,498.670135 451.831238,497.469574 C503.550903,490.297028 551.255371,499.681396 592.730408,533.012573 C597.501404,536.846741 600.827454,537.444336 606.655212,534.806274 C658.538269,511.320587 710.868774,509.894501 763.273010,533.233337 C771.331787,536.822388 778.706177,541.745728 785.930847,546.882935 C789.795044,549.630676 790.756653,552.627197 789.827942,557.104248 C783.314880,588.503357 771.275146,617.521057 752.693848,643.711243 C737.151550,665.617798 718.554321,684.553406 696.499084,700.551025z",
  path2: "M626.536560,373.123077 C621.780334,370.352417 616.568359,371.447357 611.497192,371.351379 C608.457153,371.293823 606.651733,372.847321 605.360779,375.547119 C600.337952,386.051544 602.385681,389.967865 613.939758,391.611969 C614.268860,391.658813 614.608093,391.712616 614.935181,391.682587 C619.794189,391.236816 623.110962,392.868683 623.748108,398.326569 C616.088135,398.795929 608.632080,396.500641 600.530701,395.864288 C601.892639,398.566193 603.707764,399.026123 605.344666,399.823090 C617.331604,405.658966 630.105896,403.942810 642.681885,403.601593 C654.264221,403.287292 661.081726,396.191010 661.609314,384.612244 C662.132141,373.137573 655.609985,364.428345 644.400330,363.621765 C636.437439,363.048798 628.528259,362.245483 620.605408,361.373047 C617.645447,361.047119 614.605408,361.179413 611.621704,361.387360 C601.718445,362.077515 594.228760,367.944519 591.771301,376.885040 C590.697266,380.792542 591.478821,383.929810 596.045410,385.723846 C597.288757,380.172882 598.452698,375.033508 599.587524,369.887726 C600.226257,366.991547 601.661438,364.757690 604.924561,365.066040 C611.041809,365.644043 617.200256,366.068756 623.163025,367.723969 C625.602356,368.401062 627.424988,369.656799 626.536560,373.123077z",
  path3: "M825.474243,230.982574 C818.135315,226.540146 810.629883,228.741333 809.303528,235.814453 C808.474915,240.233047 810.099670,243.647110 814.150208,245.748550 C818.109253,247.802536 823.145325,246.894455 826.031738,243.672134 C829.264343,240.063416 829.256531,236.536453 825.474243,230.982574z",
  path4: "M683.393494,358.220520 C676.333496,356.505890 672.875244,352.854614 672.037292,346.841461 C671.359558,341.978241 673.892944,338.864258 677.699036,336.637512 C683.161743,333.441528 689.346313,333.976593 693.808594,338.378998 C696.399902,340.935547 699.154785,341.841675 702.642273,342.073914 C712.598389,342.736938 722.641235,343.064850 732.449829,344.714447 C742.913330,346.474152 753.151978,349.577667 763.481934,352.122589 C785.415588,357.526306 807.344788,362.948212 830.551514,368.677643 C819.253967,360.254211 808.537964,353.039215 798.751526,344.729462 C790.492798,337.716949 781.589783,335.264648 770.953247,335.056427 C752.157288,334.688446 733.384766,333.088715 714.605408,331.955872 C712.585205,331.834015 710.898315,331.837524 709.047974,333.224731 C702.172363,338.379303 693.862366,337.243408 689.264954,330.821198 C684.386230,324.006042 685.933350,317.882416 693.909729,312.358063 C694.296692,312.090088 694.576721,311.667603 695.107178,311.103760 C694.118225,309.958344 693.132507,308.873810 692.209656,307.738159 C687.382141,301.797852 687.323853,294.881348 692.041748,290.093689 C696.932800,285.130249 704.878174,284.146484 710.109680,289.001892 C714.085815,292.692200 717.762085,292.498199 722.358521,291.500824 C740.888367,287.480072 759.454346,283.622131 778.033081,279.832001 C783.208984,278.776093 788.302429,280.392365 793.397461,281.063873 C811.865112,283.497925 830.322632,286.010834 848.771484,288.582947 C851.675476,288.987793 853.272034,287.680511 855.019531,285.580139 C862.913208,276.092651 873.485718,273.269958 884.090332,277.548889 C894.526611,281.759918 900.184326,292.188751 897.872620,302.953705 C895.520691,313.905884 885.173218,322.042511 873.832947,321.608612 C863.422974,321.210297 855.618103,316.615936 851.738892,306.623688 C850.682800,303.903290 849.160706,302.732971 846.341309,302.369476 C826.548706,299.817505 806.771667,297.144226 786.989319,294.512817 C777.831543,293.294617 769.175598,296.267883 760.363037,297.801178 C746.443726,300.222992 732.568298,302.897003 718.668884,305.434326 C713.614258,306.357056 712.217285,311.902588 707.363953,313.402985 C709.453186,316.858246 712.161133,317.555054 715.263550,317.734955 C739.519775,319.141663 763.772766,320.604034 788.028320,322.022949 C790.572876,322.171814 792.892395,322.673859 795.013000,324.280334 C812.135437,337.251251 829.353149,350.097137 846.407532,363.156403 C849.094238,365.213684 850.975281,365.217224 853.884399,363.596344 C862.503662,358.794006 871.215759,359.401917 879.417114,364.708008 C887.097839,369.677307 890.340210,376.936615 889.438660,386.076874 C888.431702,396.286987 880.038025,404.857056 869.598755,406.215698 C857.713928,407.762451 847.073914,402.384735 843.715149,392.126526 C842.075867,387.119934 839.400574,385.110321 834.555664,383.941650 C800.598633,375.750549 766.809937,366.827209 732.729187,359.202820 C721.169495,356.616730 708.932678,356.712311 696.983765,356.395294 C692.710022,356.281891 688.435486,358.966980 683.393494,358.220520z",
  path5: "M866.354858,292.925568 C865.873413,293.792389 865.231323,294.608307 864.937988,295.534698 C863.532837,299.972656 864.571594,303.769318 868.408203,306.494781 C872.392822,309.325470 877.541443,308.829712 881.157898,305.501190 C884.498596,302.426544 885.208557,298.146667 883.021179,294.270538 C880.766174,290.274780 875.835449,288.226776 871.495850,289.586182 C869.751526,290.132599 868.131409,290.994904 866.354858,292.925568z",
  path6: "M869.340210,392.066925 C874.999878,388.738129 876.800720,385.114288 875.136658,380.402924 C873.593628,376.034332 868.586243,373.182343 863.949707,374.031311 C858.967224,374.943695 855.256470,379.683105 855.809143,384.428375 C856.450867,389.938080 861.736450,393.213623 869.340210,392.066925z",
  path7: "M657.913147,314.618713 C660.652405,314.886230 663.390076,313.805511 664.917175,316.657867 C661.034119,319.498047 652.751221,319.113617 648.318115,315.796051 C651.307495,313.878052 654.501221,315.013580 657.913147,314.618713z",
  path8: "M571.907166,318.736694 C574.494751,319.036469 577.187744,318.110504 578.058411,321.274170 C574.144531,323.601868 566.969055,323.083984 563.442566,320.154083 C565.826355,317.791107 568.799255,319.075867 571.907166,318.736694z",
};

// Animation configuration for each path
const PATH_CONFIG = [
  { key: 'main', duration: 6000 },
  { key: 'path2', duration: 800 },
  { key: 'path3', duration: 300 },
  { key: 'path4', duration: 2000 },
  { key: 'path5', duration: 300 },
  { key: 'path6', duration: 300 },
  { key: 'path7', duration: 200 },
  { key: 'path8', duration: 200 },
];

// ==================== SVG PATH UTILITIES ====================
// Pure JavaScript implementation of path length and point-at-length

interface Point {
  x: number;
  y: number;
}

interface PathSegment {
  type: 'M' | 'C' | 'L' | 'Z';
  points: Point[];
  length: number;
  startLength: number;
}

// Distance between two points
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Cubic bezier point at t
function cubicBezierPoint(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

// Approximate cubic bezier length by sampling
function cubicBezierLength(p0: Point, p1: Point, p2: Point, p3: Point, samples: number = 20): number {
  let length = 0;
  let prevPoint = p0;

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const point = cubicBezierPoint(t, p0, p1, p2, p3);
    length += distance(prevPoint, point);
    prevPoint = point;
  }

  return length;
}

// Parse SVG path string and extract segments
function parsePath(d: string): PathSegment[] {
  const segments: PathSegment[] = [];
  let currentPoint: Point = { x: 0, y: 0 };
  let startPoint: Point = { x: 0, y: 0 };
  let totalLength = 0;

  // Normalize the path: add spaces around commands
  const normalized = d
    .replace(/([MCLZ])/gi, ' $1 ')
    .replace(/,/g, ' ')
    .replace(/-/g, ' -')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = normalized.split(' ').filter(t => t.length > 0);
  let i = 0;

  while (i < tokens.length) {
    const command = tokens[i].toUpperCase();
    i++;

    if (command === 'M') {
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      currentPoint = { x, y };
      startPoint = { x, y };
      segments.push({
        type: 'M',
        points: [currentPoint],
        length: 0,
        startLength: totalLength,
      });
    } else if (command === 'C') {
      const x1 = parseFloat(tokens[i++]);
      const y1 = parseFloat(tokens[i++]);
      const x2 = parseFloat(tokens[i++]);
      const y2 = parseFloat(tokens[i++]);
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);

      const p1 = { x: x1, y: y1 };
      const p2 = { x: x2, y: y2 };
      const p3 = { x, y };

      const segmentLength = cubicBezierLength(currentPoint, p1, p2, p3, 30);

      segments.push({
        type: 'C',
        points: [currentPoint, p1, p2, p3],
        length: segmentLength,
        startLength: totalLength,
      });

      totalLength += segmentLength;
      currentPoint = p3;
    } else if (command === 'L') {
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      const endPoint = { x, y };
      const segmentLength = distance(currentPoint, endPoint);

      segments.push({
        type: 'L',
        points: [currentPoint, endPoint],
        length: segmentLength,
        startLength: totalLength,
      });

      totalLength += segmentLength;
      currentPoint = endPoint;
    } else if (command === 'Z') {
      const segmentLength = distance(currentPoint, startPoint);

      if (segmentLength > 0.001) {
        segments.push({
          type: 'Z',
          points: [currentPoint, startPoint],
          length: segmentLength,
          startLength: totalLength,
        });
        totalLength += segmentLength;
      }

      currentPoint = startPoint;
    }
  }

  return segments;
}

// Get total path length
function getPathLength(segments: PathSegment[]): number {
  let total = 0;
  for (const seg of segments) {
    total += seg.length;
  }
  return total;
}

// Get point at specific length along path
function getPointAtLength(segments: PathSegment[], targetLength: number): Point {
  let accumulatedLength = 0;

  for (const segment of segments) {
    if (segment.type === 'M') {
      continue;
    }

    if (accumulatedLength + segment.length >= targetLength) {
      const localLength = targetLength - accumulatedLength;
      const t = segment.length > 0 ? localLength / segment.length : 0;

      if (segment.type === 'C') {
        const [p0, p1, p2, p3] = segment.points;
        return cubicBezierPoint(t, p0, p1, p2, p3);
      } else if (segment.type === 'L' || segment.type === 'Z') {
        const [start, end] = segment.points;
        return {
          x: start.x + t * (end.x - start.x),
          y: start.y + t * (end.y - start.y),
        };
      }
    }

    accumulatedLength += segment.length;
  }

  // Return last point
  const lastSeg = segments[segments.length - 1];
  if (lastSeg && lastSeg.points.length > 0) {
    return lastSeg.points[lastSeg.points.length - 1];
  }

  return { x: 0, y: 0 };
}

// ==================== COMPONENT ====================

interface Spark {
  id: number;
  x: number;
  y: number;
  opacity: RNAnimated.Value;
}

interface GeneratingWorkoutModalProps {
  visible: boolean;
}

export function GeneratingWorkoutModal({ visible }: GeneratingWorkoutModalProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);
  const [laserPosition, setLaserPosition] = useState({ x: 0, y: 0 });
  const [laserVisible, setLaserVisible] = useState(false);
  const [strokeOffsets, setStrokeOffsets] = useState<{ [key: string]: number }>({});
  const [fillOpacities, setFillOpacities] = useState<{ [key: string]: number }>({});
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [showEnergyRings, setShowEnergyRings] = useState(false);
  const [showOrbitParticles, setShowOrbitParticles] = useState(false);

  const fadeAnim = useRef(new RNAnimated.Value(1)).current;
  const glowAnim = useRef(new RNAnimated.Value(0)).current;
  const fillPulseAnim = useRef(new RNAnimated.Value(0)).current;
  const shimmerAnim = useRef(new RNAnimated.Value(0)).current;
  const energyRingAnims = useRef([
    new RNAnimated.Value(0),
    new RNAnimated.Value(0),
    new RNAnimated.Value(0),
  ]).current;
  const orbitAnims = useRef([
    new RNAnimated.Value(0),
    new RNAnimated.Value(0),
    new RNAnimated.Value(0),
    new RNAnimated.Value(0),
  ]).current;

  const animationRunning = useRef(false);
  const sparkIdCounter = useRef(0);
  const containerSize = 200;
  const svgViewBox = 1024;
  const scale = containerSize / svgViewBox;

  // Pre-parse all paths
  const parsedPaths = useMemo(() => {
    const result: { [key: string]: { segments: PathSegment[]; totalLength: number } } = {};
    for (const [key, d] of Object.entries(PATHS)) {
      const segments = parsePath(d);
      const totalLength = getPathLength(segments);
      result[key] = { segments, totalLength };
    }
    return result;
  }, []);

  // Convert SVG coordinates to container coordinates
  const svgToContainer = useCallback((svgX: number, svgY: number) => {
    return {
      x: svgX * scale,
      y: svgY * scale,
    };
  }, [scale]);

  // Store the current laser position in a ref so spark interval can access latest value
  const laserPosRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    laserPosRef.current = laserPosition;
  }, [laserPosition]);

  // Create a spark particle
  const createSpark = useCallback((x: number, y: number) => {
    const id = sparkIdCounter.current++;
    const opacity = new RNAnimated.Value(0.8);

    setSparks(prev => [...prev, { id, x, y, opacity }]);

    // Fade out and remove
    setTimeout(() => {
      RNAnimated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setSparks(prev => prev.filter(s => s.id !== id));
      });
    }, 50);
  }, []);

  // Animate a single path with synchronized laser
  const animatePathWithLaser = useCallback(async (pathKey: string, duration: number) => {
    return new Promise<void>((resolve) => {
      const pathData = parsedPaths[pathKey];
      if (!pathData || pathData.totalLength === 0) {
        setStrokeOffsets(prev => ({ ...prev, [pathKey]: 0 }));
        setFillOpacities(prev => ({ ...prev, [pathKey]: 1 }));
        setTimeout(resolve, 100);
        return;
      }

      const { segments, totalLength } = pathData;
      setStrokeOffsets(prev => ({ ...prev, [pathKey]: totalLength }));

      const startTime = performance.now();
      let sparkInterval: ReturnType<typeof setInterval> | null = null;

      // Create spark trail for longer paths
      if (duration > 500) {
        sparkInterval = setInterval(() => {
          const pos = laserPosRef.current;
          createSpark(pos.x, pos.y);
        }, 30);
      }

      const animate = (currentTime: number) => {
        if (!animationRunning.current) {
          if (sparkInterval) clearInterval(sparkInterval);
          resolve();
          return;
        }

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Stroke trails 2% behind laser
        const strokeProgress = Math.max(0, progress - 0.02);
        setStrokeOffsets(prev => ({ ...prev, [pathKey]: totalLength * (1 - strokeProgress) }));

        // Update laser position using our pure JS implementation
        const point = getPointAtLength(segments, progress * totalLength);
        const containerPos = svgToContainer(point.x, point.y);
        setLaserPosition(containerPos);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Ensure stroke is fully drawn
          setStrokeOffsets(prev => ({ ...prev, [pathKey]: 0 }));

          if (sparkInterval) clearInterval(sparkInterval);

          // Fade in fill
          setFillOpacities(prev => ({ ...prev, [pathKey]: 1 }));

          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }, [parsedPaths, svgToContainer, createSpark]);

  // Run the full animation sequence
  const runAnimation = useCallback(async () => {
    if (!visible || animationRunning.current) return;

    animationRunning.current = true;

    // Reset state
    setStrokeOffsets({});
    setFillOpacities({});
    setSparks([]);
    setShowEnergyRings(false);
    setShowOrbitParticles(false);
    setLaserVisible(false);

    // Small delay before starting
    await new Promise(r => setTimeout(r, 100));

    if (!animationRunning.current) return;

    // Show laser
    setLaserVisible(true);

    // Animate glow
    RNAnimated.timing(glowAnim, {
      toValue: 0.5,
      duration: 8000,
      useNativeDriver: true,
    }).start();

    // Animate each path sequentially
    for (const config of PATH_CONFIG) {
      if (!animationRunning.current) break;
      await animatePathWithLaser(config.key, config.duration);
    }

    if (!animationRunning.current) return;

    // Hide laser
    setLaserVisible(false);

    // Show energy rings and orbit particles
    setShowEnergyRings(true);
    setShowOrbitParticles(true);

    // Start fill pulse animation (gentle brightness oscillation)
    const animateFillPulse = () => {
      if (!animationRunning.current) return;
      RNAnimated.sequence([
        RNAnimated.timing(fillPulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        RNAnimated.timing(fillPulseAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ]).start(() => {
        if (animationRunning.current) {
          animateFillPulse();
        }
      });
    };
    animateFillPulse();

    // Start shimmer animation (shiny gradient sweep)
    const animateShimmer = () => {
      if (!animationRunning.current) return;
      shimmerAnim.setValue(0);
      RNAnimated.timing(shimmerAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      }).start(() => {
        if (animationRunning.current) {
          animateShimmer();
        }
      });
    };
    animateShimmer();

    // Animate energy rings
    energyRingAnims.forEach((anim, index) => {
      const delay = index * 500;
      setTimeout(() => {
        const animateRing = () => {
          anim.setValue(0);
          RNAnimated.timing(anim, {
            toValue: 1,
            duration: 2500,
            useNativeDriver: true,
          }).start(() => {
            if (animationRunning.current) {
              animateRing();
            }
          });
        };
        animateRing();
      }, delay);
    });

    // Animate orbit particles
    orbitAnims.forEach((anim, index) => {
      const duration = 4000 + index * 500;
      const animateOrbit = () => {
        anim.setValue(0);
        RNAnimated.timing(anim, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }).start(() => {
          if (animationRunning.current) {
            animateOrbit();
          }
        });
      };
      animateOrbit();
    });
  }, [visible, animatePathWithLaser, glowAnim, fillPulseAnim, shimmerAnim, energyRingAnims, orbitAnims]);

  // Reset and start animation when modal becomes visible
  useEffect(() => {
    if (visible) {
      animationRunning.current = false;
      setAnimationKey(prev => prev + 1);
      setMessageIndex(0);
      glowAnim.setValue(0);
      fillPulseAnim.setValue(0);
      shimmerAnim.setValue(0);

      // Give time for component to mount
      setTimeout(() => {
        runAnimation();
      }, 150);
    } else {
      animationRunning.current = false;
    }

    return () => {
      animationRunning.current = false;
    };
  }, [visible]);

  // Cycle through messages
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      RNAnimated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setMessageIndex(prev => (prev + 1) % MESSAGES.length);
        RNAnimated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [visible, fadeAnim]);

  const renderEnergyRings = () => {
    if (!showEnergyRings) return null;

    return energyRingAnims.map((anim, index) => {
      const scaleVal = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.5, 1.5],
      });
      const opacity = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.6, 0],
      });

      return (
        <RNAnimated.View
          key={`ring-${index}`}
          style={[
            styles.energyRing,
            {
              transform: [{ scale: scaleVal }],
              opacity,
            },
          ]}
        />
      );
    });
  };

  const renderOrbitParticles = () => {
    if (!showOrbitParticles) return null;

    const orbitRadii = [70, 72, 68, 74];
    const startAngles = [0, 90, 180, 270];

    return orbitAnims.map((anim, index) => {
      const rotation = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [`${startAngles[index]}deg`, `${startAngles[index] + 360}deg`],
      });

      return (
        <RNAnimated.View
          key={`orbit-${index}`}
          style={[
            styles.orbitParticleContainer,
            {
              transform: [{ rotate: rotation }],
            },
          ]}
        >
          <View style={[styles.orbitParticle, { marginLeft: orbitRadii[index] }]} />
        </RNAnimated.View>
      );
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Outer glow */}
          <RNAnimated.View style={[styles.outerGlow, { opacity: glowAnim }]} />

          {/* Energy rings */}
          {renderEnergyRings()}

          {/* Logo container */}
          <View style={styles.logoContainer}>
            {/* Laser point */}
            {laserVisible && (
              <View
                style={[
                  styles.laserPoint,
                  {
                    left: laserPosition.x,
                    top: laserPosition.y,
                  },
                ]}
              />
            )}

            {/* Spark particles */}
            {sparks.map(spark => (
              <RNAnimated.View
                key={spark.id}
                style={[
                  styles.spark,
                  {
                    left: spark.x,
                    top: spark.y,
                    opacity: spark.opacity,
                  },
                ]}
              />
            ))}

            {/* SVG Logo */}
            <Svg
              key={animationKey}
              width={containerSize}
              height={containerSize}
              viewBox="0 0 1024 1024"
              style={styles.svg}
            >
              <Defs>
                {/* Base gradient for the fill */}
                <RadialGradient id="logoGradient" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#818CF8" />
                  <Stop offset="70%" stopColor="#6366F1" />
                  <Stop offset="100%" stopColor="#4F46E5" />
                </RadialGradient>
                {/* Brighter gradient for pulse glow effect */}
                <RadialGradient id="logoGradientBright" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#A5B4FC" />
                  <Stop offset="50%" stopColor="#818CF8" />
                  <Stop offset="100%" stopColor="#6366F1" />
                </RadialGradient>
                {/* Shimmer/shiny gradient overlay */}
                <LinearGradient id="shimmerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="transparent" />
                  <Stop offset="40%" stopColor="transparent" />
                  <Stop offset="50%" stopColor="rgba(255,255,255,0.4)" />
                  <Stop offset="60%" stopColor="transparent" />
                  <Stop offset="100%" stopColor="transparent" />
                </LinearGradient>
                <LinearGradient id="strokeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#A5B4FC" />
                  <Stop offset="50%" stopColor="#818CF8" />
                  <Stop offset="100%" stopColor="#6366F1" />
                </LinearGradient>
              </Defs>

              {/* Fill paths - base layer */}
              {Object.entries(PATHS).map(([key, d]) => (
                <Path
                  key={`fill-${key}`}
                  d={d}
                  fill="url(#logoGradient)"
                  opacity={fillOpacities[key] ?? 0}
                />
              ))}

              {/* Fill paths - bright pulse layer */}
              {Object.entries(PATHS).map(([key, d]) => {
                const baseOpacity = fillOpacities[key] ?? 0;
                // Create animated opacity for the bright layer
                const pulseOpacity = fillPulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.6],
                });
                return (
                  <AnimatedPath
                    key={`fill-pulse-${key}`}
                    d={d}
                    fill="url(#logoGradientBright)"
                    opacity={baseOpacity > 0 ? pulseOpacity : 0}
                  />
                );
              })}

              {/* Shimmer overlay layer */}
              {Object.entries(PATHS).map(([key, d]) => {
                const baseOpacity = fillOpacities[key] ?? 0;
                // Animate shimmer sweep across the logo
                const shimmerOpacity = shimmerAnim.interpolate({
                  inputRange: [0, 0.3, 0.5, 0.7, 1],
                  outputRange: [0, 0.5, 1, 0.5, 0],
                });
                return (
                  <AnimatedPath
                    key={`fill-shimmer-${key}`}
                    d={d}
                    fill="url(#shimmerGradient)"
                    opacity={baseOpacity > 0 ? shimmerOpacity : 0}
                  />
                );
              })}

              {/* Stroke paths */}
              {Object.entries(PATHS).map(([key, d]) => {
                const pathData = parsedPaths[key];
                const pathLength = pathData?.totalLength ?? 99999;
                return (
                  <Path
                    key={`stroke-${key}`}
                    d={d}
                    fill="none"
                    stroke="url(#strokeGradient)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={`${pathLength}`}
                    strokeDashoffset={strokeOffsets[key] ?? pathLength}
                  />
                );
              })}
            </Svg>
          </View>

          {/* Orbit particles */}
          <View style={styles.orbitContainer}>
            {renderOrbitParticles()}
          </View>

          {/* Text */}
          <Text style={styles.title}>Generating Workout</Text>
          <RNAnimated.Text style={[styles.subtitle, { opacity: fadeAnim }]}>
            {MESSAGES[messageIndex]}
          </RNAnimated.Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  outerGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#6366F1',
    top: 10,
    ...(Platform.OS === 'web' ? { filter: 'blur(30px)' } : {}),
  },
  logoContainer: {
    width: 200,
    height: 200,
    position: 'relative',
    marginBottom: spacing.xl,
  },
  svg: {
    overflow: 'visible',
  },
  laserPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
    transform: [{ translateX: -4 }, { translateY: -4 }],
    zIndex: 100,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 4px #fff, 0 0 8px #fff, 0 0 15px #A5B4FC, 0 0 25px #818CF8, 0 0 40px #6366F1',
    } : {
      shadowColor: '#fff',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 10,
    }),
  },
  spark: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: 'rgba(129, 140, 248, 0.6)',
    borderRadius: 2,
    transform: [{ translateX: -2 }, { translateY: -2 }],
    zIndex: 99,
  },
  energyRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#818CF8',
    top: 40,
  },
  orbitContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
    top: 120,
    left: '50%',
  },
  orbitParticleContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  orbitParticle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#818CF8',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 10px #818CF8, 0 0 20px #818CF8',
    } : {
      shadowColor: '#818CF8',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 10,
    }),
  },
  title: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold as any,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
