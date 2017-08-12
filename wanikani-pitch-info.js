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
    
    var sessionChar = document.getElementById("character"); //Check for seassion character
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
    }
}