// ==UserScript==
// @name         WaniKani Pitch Info
// @include     https://www.wanikani.com/*
// @include     http://www.wanikani.com/*
// @run-at document-end
// @namespace    https://greasyfork.org/en/scripts/31070-wanikani-pitch-info
// @version      0.19
// @description  Grabs Pitch value for a given Vocab from weblio.jp and displays it on a WaniKani vocab or session page.
// @author       Invertex
// @supportURL http://invertex.xyz
// @grant GM_xmlhttpRequest
// @connect weblio.jp/*
// @connect weblio.jp
// ==/UserScript==

var vocab = "";
var vocabPitchType = -1;
var savedReading = "";
var sessionReadingElem;
var pitchInfoElem;
var descriptionElem;
var readingElem;
var reading = "";
var pitchInfoLoadTxt = "Loading Pitch info...";
var kanaElem = null;

$(document).ready(function()
{
    parsePage();
    
    var observer = new MutationObserver(function(mutations)
    {
         mutations.forEach(function(mutation)
         {
             parsePage();
         });
    });

    descriptionElem = document.getElementsByClassName('pure-g-r')[0];
    if(descriptionElem != null){
        observer.observe(descriptionElem, {attributes: true, attributeFilter: ['style', 'class'], subtree:true}); 
    }
    readingElem = document.getElementById('supplement-voc-reading');
    if(readingElem != null){
        observer.observe(readingElem, {attributes: true, attributeFilter: ['style', 'class'], subtree:true}); 
    }
    /*    var allInfo = document.getElementById('all-info');
    if(itemInfo != null){
        observer.observe(itemInfo, {attributes: true, attributeFilter: ['style', 'class']}); 
        console.log("all info watch");
    }*/
});

function parsePage()
{
    var tmpVocab = "";
    var tmpSessionElem;
    
    var sessionChar = document.getElementById("character"); //Check for session character
	if(sessionChar != null && ($(sessionChar).hasClass('vocabulary') || $('#main-info').hasClass('vocabulary')))
	{
		var sessionVocElem = sessionChar.getElementsByTagName("span")[0]; //Get sub element that contains the characters.
        if(sessionVocElem != null)
        {
            tmpVocab = sessionVocElem.innerHTML;
            tmpSessionElem = document.getElementById("item-info-reading");
        }
		else //We must be in Lesson session if there is no "span" element, characters are in first element we got.
		{
           tmpVocab = sessionChar.innerHTML;
           var descripDivs = document.getElementById("supplement-voc-reading").getElementsByClassName("col1")[0];
           tmpSessionElem = descripDivs;
        }
	}
    else //Check for Vocab page element
    {
       var vocabIcon = document.getElementsByClassName("vocabulary-icon")[0];
	   if(vocabIcon != null)
	   {
           tmpVocab = $(vocabIcon.getElementsByTagName("span")[0]).html();
           tmpSessionElem = document.getElementsByClassName("vocabulary-reading")[0];
        }
        //Individual Kanji shouldn't be looked for I guess, so deprecated. Uncomment this section if you'd like it to be
        /*else //Must be on a Kanji page instead of Vocab, check for other element
        {
            var kanjiIcon = document.getElementsByClassName("kanji-icon")[0];
            if(kanjiIcon != null)
            {
                vocab = $(kanjiIcon.getElementsByTagName("span")[0]).html();
                var kunYomiDisp = document.getElementsByTagName("H3");
                var kunYomiElem;
                if(kunYomiDisp != null)
                {
                    for(i = 0; i < kunYomiDisp.length; i++)
                    {
                        if(kunYomiDisp[i].innerHTML === "Kun'yomi")
                        {
                            sessionReadingElem = kunYomiDisp[i].parentNode;
                            break;
                        }
                    }
                }
            }
        }*/
	}
    if(tmpSessionElem != null)
    {
        var spanElem = findChildElemWithAttr(tmpSessionElem, "span", "lang");
        if(spanElem == null){
            spanElem = findChildElemWithAttr(tmpSessionElem, "p", "lang");
        }
        if(spanElem == null){
            spanElem = findChildElemWithAttr(tmpSessionElem, "div", "lang");
        }
        if(spanElem != null){
            reading = spanElem.textContent.replace(/\s+/g, '').split(',')[0];
        }
    }
	if(tmpVocab != null && tmpVocab != "" && !tmpVocab.includes("nbsp") && tmpSessionElem != null && reading != null && reading != "")
	{
        if(!tmpSessionElem.hasAttribute("vocabpitch"))
        {
	        tmpSessionElem.setAttribute("vocabpitch", true);
        }
        
        sessionReadingElem = tmpSessionElem;
        pitchInfoElem = sessionReadingElem.getElementsByClassName("pitchInfo")[0];
        
        if(pitchInfoElem == null)
        {
            pitchInfoElem = document.createElement("P");
            pitchInfoElem.className = "pitchInfo";
            sessionReadingElem.appendChild(pitchInfoElem);
            pitchInfoElem.innerHTML = pitchInfoLoadTxt;
            getVocabPitch(tmpVocab);
        }
        else if((pitchInfoElem.innerHTML != pitchInfoLoadTxt && tmpVocab != vocab) || tmpVocab != vocab)
        {
            pitchInfoElem.innerHTML = pitchInfoLoadTxt;
            getVocabPitch(tmpVocab);
        }
	}
}

function findChildElemWithAttr(parentElem, elemType, attrType)
{
    var childElems = parentElem.getElementsByTagName(elemType);
    
    for(i = 0; i < childElems.length; i++)
    {
        if(childElems[i].hasAttribute(attrType))
        {
            return childElems[i];
        }
    }
    return null;
}

function getVocabPitch(inVocab)
{
        vocab = inVocab;

        GM_xmlhttpRequest({
            method: "GET",
            url: "http://www.weblio.jp/content/" + inVocab,
            onload: parseResponse
        });
}

function parseResponse(responseObj)
{
	var dparser = new DOMParser();
    var respDoc = dparser.parseFromString(responseObj.responseText, "text/html").documentElement;
	var vocabResults = respDoc.getElementsByClassName('midashigo');
    
	if(vocabResults != null)
    {
		for(i = 0; i < vocabResults.length; i++)
        {
            var title = $(vocabResults[i]).attr("title");
			if(title == vocab && vocabResults[i].textContent.replace(/\s+/g, '').replace("・","").includes(reading))
			{
				var spans = vocabResults[i].getElementsByTagName("span");
                if(spans != null)
                {
                    var numMatch;
                    var numMatch2;
                    for(s = 0; s < spans.length; s++)
                    {
                        var spanText = spans[s].textContent;
                        if(spanText.includes("［"))
                        {
			               var parseNum = parseInt(spanText.match(/\d+/g));
                            if(numMatch == null)
                            {
                                numMatch = parseNum;
                            } else if(numMatch2 == null)
                            {
                                numMatch2 = parseNum;
                                break;
                            }
                        }
                    }
                    if(numMatch != null)
				    {
                        vocabPitchType = numMatch;
                        writeToPage(numMatch, numMatch2);
                        return null;
				    }
                }
			}
		}
	}
   vocabPitchType = -1;
   writeToPage(vocabPitchType);
}

function getPitchType(pitchNum)
{
    if(pitchNum === 0){
        return "Pitch starts low, ends high.";
    }
    else if(pitchNum === 1){
        return "Pitch starts high, ends low.";
    }
    else if(pitchNum >= 0)
    {
        return "Pitch starts low, stays high for " + pitchNum + " mora, ends low.";
    }
    else
    {
        return "No pitch value found, click the number for more info.";
    }
}

function getKanaElemThruSibling(el)
{
    // search for sibling element with lang="ja"
    var tmpKanaElem = null;
    var s = el.parentNode.firstChild;
    while(s)
    {
        if(s.nodeType === 1 && s !== el && s.getAttribute("lang") == "ja")
        {
            tmpKanaElem = s;
            break;
        }
        s = s.nextSibling;
    }
    return tmpKanaElem;
}

function drawPitchDiagram(pitchNum)
{
    var colorCode = "#f900a6";

    if (pitchInfoElem == null){ return; }

    // Get sibling that contains vocabulary kana
    kanaElem = getKanaElemThruSibling(pitchInfoElem);
    if (kanaElem == null){
        console.log("Failed to find kana element.");
        return;
    }

    // get number of kana
    var kana = kanaElem.innerText || null;
    if (kana == null){
        console.log("Failed to find kana innerText.");
        return;
    }

    // remove white space, and count kana
    kana = kana.trim();
    var kanaLength = kana.length;
    var kana_plus_particle_length = kanaLength + 1;

    /*
    	Prepare elements for drawing
    */

    // use the font size to calculate height and width
    var fontSize =  window.getComputedStyle(kanaElem, null).getPropertyValue('font-size');
    fontSize = parseFloat(fontSize); 
    var svg_w = fontSize * kana_plus_particle_length;
    var svg_h = fontSize + 10;

    // absolute positioned container
    var pitchDiagram = document.createElement("DIV");
    pitchDiagram.style.position = "absolute";
    pitchDiagram.style.left = "0";
    pitchDiagram.style.top = "0";
    pitchDiagram.style.width = svg_w + "px";
    pitchDiagram.style.height = svg_h + "px";

    // add space to parent element
    kanaElem.style.position = "relative";
    kanaElem.style.paddingTop = fontSize + "px";

    // the svg which will be drawn to
    var namespace = "http://www.w3.org/2000/svg";
		var svg = document.createElementNS(namespace, "svg");
		svg.setAttribute("width",svg_w);
		svg.setAttribute("height",svg_h);

		var w = 5; // dot size

		/*
			Start drawing
		*/

    var points = [];
    function calculatePoints(p,i) {
        var cx = ((i * 100) - ((w*2)/svg_w * 100)) + "%";
        var cy = (p == 0) ? "75%" : "15%";
        points.push({"x": cx, "y": cy});
    }

    function drawPitchDot(cx, cy, is_particle) {
  			var circle = document.createElementNS(namespace, "circle");
				circle.setAttribute("fill", (is_particle) ? "white" : colorCode);
				circle.setAttribute("stroke",  (is_particle) ? "black" : colorCode);
				circle.setAttribute("stroke-width", (is_particle) ? "1" : "0");
				circle.setAttribute("cx", cx);
				circle.setAttribute("cy", cy);
				circle.setAttribute("r", w/2);
				svg.appendChild(circle);
    }

    function drawLine(x1,y1,x2,y2) {
			var line = document.createElementNS(namespace, "line");
    	line.setAttribute("stroke", colorCode);
			line.setAttribute("stroke-width", "2");
			line.setAttribute("x1", x1);
			line.setAttribute("y1", y1);
			line.setAttribute("x2", x2);
			line.setAttribute("y2", y2);
			svg.appendChild(line);
    }

    /*
        TODO:
            does weblio use 1-6 for pitch accent
            color codes
    */

    var pitchPatterns = 
    [
        /* 1 mora */[ [0,1], [1,0] ],
        /* 2 mora */[ [0,1,1], [1,0,0], [0,1,0] ],   
        /* 3 mora */[ [0,1,1,1], [1,0,0,0], [0,1,0,0], [0,1,1,0] ],
        /* 4 mora */[ [0,1,1,1,1], [1,0,0,0,0], [0,1,0,0,0], [0,1,1,0,0], [0,1,1,1,0] ],
        /* 5 mora */[ [0,1,1,1,1,1], [1,0,0,0,0,0], [0,1,0,0,0,0], [0,1,1,0,0,0], [0,1,1,1,0,0], [0,1,1,1,1,0] ],
        /* 6 mora */[ [0,1,1,1,1,1,1], [1,0,0,0,0,0,0], [0,1,0,0,0,0,0], [0,1,1,0,0,0,0], [0,1,1,1,0,0,0], [0,1,1,1,1,0,0], [0,1,1,1,1,1,0] ]
    ];

    if (pitchNum == 0)
    {
        colorCode = "#d20ca3";
    }
    else if (pitchNum == 1) {
        colorCode = "#ffac24";
    }
    else if (pitchNum == 2) {
        colorCode = "#0cd24d";
    }
    else if (pitchNum == 3) {
        colorCode = "#e42432";
    }
    else if (pitchNum == 4) {
        colorCode = "#0098e4";
    }

    /* find pattern from table */
    var x = pitchNum;
    var y = kanaLength;
    var pattern = pitchPatterns[y][x];
    console.log("pattern",pattern);

    /* draw the pattern */
    for (var i = 1; i <= kana_plus_particle_length; i++)
    {
    	calculatePoints(pattern[i-1], i/(kana_plus_particle_length));
    }

    for (var i = 0; i < points.length - 1; i++)
    {
    	drawLine(points[i].x, points[i].y, points[i+1].x, points[i+1].y);
    }

    for (var i = 0; i < points.length; i++)
    {
      drawPitchDot(points[i].x, points[i].y, i == points.length - 1);
    }

		pitchDiagram.appendChild(svg);
    kanaElem.appendChild(pitchDiagram);
    return;
}

function writeToPage(pitchNum, pitchNum2)
{
    var appendHtml = getPitchType(pitchNum) + " <a href=\"http://www.weblio.jp/content/" + vocab +"\" target=\"_blank\" >[" + pitchNum + "]</a>";

    if(pitchNum2 != null)
    {
        appendHtml += "<br/>or<br/>" + getPitchType(pitchNum2) + " <a href=\"http://www.weblio.jp/content/" + vocab +"\" target=\"_blank\" >[" + pitchNum2 + "]</a>";
    }
    
    if(pitchInfoElem != null)
    {
        pitchInfoElem.innerHTML = appendHtml;
        drawPitchDiagram(pitchNum);
    }
}
